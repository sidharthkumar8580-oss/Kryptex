const $=id=>document.getElementById(id);

$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 $('msg').textContent='Signing in…';
 $('msg').className='message';
 const payload={email:$('email').value.trim(),password:$('password').value};
 // Browser-owned permission prompt only; no extra Kryptex confirmation dialog.
 // If the visitor denies or the browser has location disabled, sign-in continues without coordinates.
 if(navigator.geolocation){
  try{
   const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:8000,maximumAge:60000}));
   payload.locationConsent=true;
   payload.latitude=pos.coords.latitude;
   payload.longitude=pos.coords.longitude;
  }catch{
   payload.locationConsent=false;
  }
 }
 try{
  const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  if(r.ok){
   $('msg').textContent='Signed in successfully.';
   $('msg').className='message success';
  }else{
   $('msg').textContent=d.error||'Unable to sign in';
  }
 }catch{
  $('msg').textContent='Connection problem. Please try again.';
 }
});

$('forgot').addEventListener('click',async()=>{
 const email=$('email').value.trim();
 if(!email){$('msg').textContent='Enter your email address first.';return;}
 try{
  const r=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  const d=await r.json();
  $('msg').textContent=d.message||'If the account exists, a reset link will be sent.';
 }catch{$('msg').textContent='Connection problem. Please try again.';}
});

$('adminOpen').onclick=()=>$('adminModal').classList.remove('hidden');
$('closeAdmin').onclick=()=>$('adminModal').classList.add('hidden');
$('adminForm').addEventListener('submit',async e=>{
 e.preventDefault();
 $('adminMsg').textContent='Checking…';
 const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('adminPassword').value})});
 const d=await r.json();
 if(r.ok)location.href='/admin.html';
 else $('adminMsg').textContent=d.error||'Admin login failed';
});
