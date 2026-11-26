const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data.json");
if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD) {
  console.warn("Set SESSION_SECRET and ADMIN_PASSWORD in environment variables before production use.");
}
app.set("trust proxy", 1);
app.use(express.json({limit:"20kb"}));
app.use(express.static(path.join(__dirname,"public")));
app.use(session({
  name:"kryptex.sid",
  secret:process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",maxAge:8*60*60*1000}
}));
const limiter = rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:true,legacyHeaders:false});
app.use("/api",limiter);

function readDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE,"utf8")); }
  catch { return {users:[],visits:[],resetTokens:[]}; }
}
function writeDB(db){ fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2),{mode:0o600}); }
function cleanUser(u){ return {id:u.id,email:u.email,mobile:u.mobile||"",createdAt:u.createdAt,lastLogin:u.lastLogin||null}; }
function requireUser(req,res,next){ if(!req.session.userId) return res.status(401).json({error:"Please log in"}); next(); }
function requireAdmin(req,res,next){ if(!req.session.isAdmin) return res.status(401).json({error:"Admin login required"}); next(); }
function getIp(req){ return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").toString().split(",")[0].trim().replace(/^::ffff:/,""); }

app.post("/api/login", async (req,res)=>{
  const {email,password,latitude,longitude,locationConsent}=req.body||{};
  if(!email||!password) return res.status(400).json({error:"Email and password required"});
  const db=readDB(), user=db.users.find(x=>x.email.toLowerCase()===String(email).toLowerCase());
  if(!user || !(await bcrypt.compare(String(password),user.passwordHash))) return res.status(401).json({error:"Incorrect email or password"});
  req.session.userId=user.id;
  user.lastLogin=new Date().toISOString();
  const visit={id:crypto.randomUUID(),userId:user.id,email:user.email,ip:getIp(req),ipv6:(getIp(req).includes(":")?getIp(req):null),userAgent:req.headers["user-agent"]||"",visitedAt:new Date().toISOString(),latitude:null,longitude:null,locationConsent:false};
  if(locationConsent===true && Number.isFinite(latitude) && Number.isFinite(longitude)){
    visit.latitude=latitude; visit.longitude=longitude; visit.locationConsent=true;
  }
  db.visits.unshift(visit); db.visits=db.visits.slice(0,5000); writeDB(db);
  res.json({ok:true,user:cleanUser(user)});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",requireUser,(req,res)=>{
  const u=readDB().users.find(x=>x.id===req.session.userId);
  if(!u) return res.status(401).json({error:"Session expired"});
  res.json({user:cleanUser(u)});
});
app.post("/api/forgot-password",async(req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase();
  const db=readDB(), user=db.users.find(x=>x.email.toLowerCase()===email);
  // Same response whether account exists or not, to avoid revealing registered emails.
  if(user && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS){
    const token=crypto.randomBytes(32).toString("hex");
    db.resetTokens=db.resetTokens.filter(x=>x.userId!==user.id);
    db.resetTokens.push({tokenHash:crypto.createHash("sha256").update(token).digest("hex"),userId:user.id,expiresAt:Date.now()+30*60*1000});
    writeDB(db);
    const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
    const link=(process.env.BASE_URL||"").replace(/\/$/,"")+"/reset.html?token="+token;
    await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:user.email,subject:"Kryptex password reset",text:"Reset your password using this one-time link (valid for 30 minutes): "+link});
  }
  res.json({ok:true,message:"If the account exists and email is configured, a reset link will be sent."});
});
app.post("/api/reset-password",async(req,res)=>{
  const token=String(req.body?.token||""), password=String(req.body?.password||"");
  if(password.length<10) return res.status(400).json({error:"Use at least 10 characters"});
  const db=readDB(), hash=crypto.createHash("sha256").update(token).digest("hex");
  const item=db.resetTokens.find(x=>x.tokenHash===hash && x.expiresAt>Date.now());
  if(!item) return res.status(400).json({error:"Reset link is invalid or expired"});
  const user=db.users.find(x=>x.id===item.userId);
  if(!user) return res.status(400).json({error:"Account not found"});
  user.passwordHash=await bcrypt.hash(password,12);
  db.resetTokens=db.resetTokens.filter(x=>x.userId!==user.id); writeDB(db);
  res.json({ok:true});
});

// Admin login is separate from normal user login. Set ADMIN_PASSWORD in host secrets.
app.post("/api/admin/login",(req,res)=>{
  if(!process.env.ADMIN_PASSWORD) return res.status(503).json({error:"Admin password is not configured"});
  if(String(req.body?.password||"")!==process.env.ADMIN_PASSWORD) return res.status(401).json({error:"Wrong admin password"});
  req.session.isAdmin=true; res.json({ok:true});
});
app.post("/api/admin/logout",(req,res)=>{req.session.isAdmin=false;res.json({ok:true});});
app.get("/api/admin/data",requireAdmin,(req,res)=>{
  const db=readDB();
  res.json({users:db.users.map(cleanUser),visits:db.visits.map(v=>({...v}))});
});
app.post("/api/admin/users",requireAdmin,async(req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase();
  const password=String(req.body?.password||"");
  const mobile=String(req.body?.mobile||"").trim();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:"Valid email required"});
  if(password.length<10) return res.status(400).json({error:"Password must be at least 10 characters"});
  const db=readDB();
  if(db.users.some(u=>u.email.toLowerCase()===email)) return res.status(409).json({error:"Email already exists"});
  db.users.push({id:crypto.randomUUID(),email,mobile,passwordHash:await bcrypt.hash(password,12),createdAt:new Date().toISOString()});
  writeDB(db); res.json({ok:true});
});
app.delete("/api/admin/users/:id",requireAdmin,(req,res)=>{
  const db=readDB(); db.users=db.users.filter(u=>u.id!==req.params.id); db.visits=db.visits.filter(v=>v.userId!==req.params.id); writeDB(db); res.json({ok:true});
});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Kryptex running on "+PORT));
