const $=id=>document.getElementById(id);
$('loginForm').addEventListener('submit',async e=>{
 e.preventDefault(); $('msg').textContent='Signing in…';
 const payload={email:$('email').value,password:$('password').value};
 // Ask for precise location only after explicit opt-in; never prompt automatically.
 if(window.confirm('Allow Kryptex to save your latitude and longitude with this login? Choose Cancel to continue without sharing location.')){
  try{const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:7000}));payload.locationConsent=true;payload.latitude=pos.coords.latitude;payload.longitude=pos.coords.longitude;}catch{payload.locationConsent=false;}
 }
 const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();
 if(r.ok){$('msg').textContent='Login successful. Welcome!';$('msg').className='message success';}else{$('msg').textContent=d.error||'Unable to sign in';}
});
$('forgot').addEventListener('click',async()=>{const email=$('email').value.trim();if(!email){$('msg').textContent='Enter your email address first.';return;}const r=await fetch('/api/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const d=await r.json();$('msg').textContent=d.message||'If the account exists, a reset link will be sent.';});
$('adminOpen').onclick=()=>$('adminModal').classList.remove('hidden');$('closeAdmin').onclick=()=>$('adminModal').classList.add('hidden');
$('adminForm').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('adminPassword').value})});const d=await r.json();if(r.ok)location.href='/admin.html';else $('adminMsg').textContent=d.error||'Admin login failed';});