import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { url, FETCH_CREDENTIALS } from './apiClient';

const AUTO_REDIRECT = true;
const REDIRECT_DELAY_MS = 2000;

export default function Registration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [finished, setFinished] = useState(false);
  const [form, setForm] = useState({
    username: '',
    registrationKey: '',
    fullName: '',
    email: '',
    phone: '',
    otp: '',
    password: '',
    confirmPassword: ''
  });
  const [accepted,setAccepted]=useState(false);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [cooldown,setCooldown]=useState(0);

  useEffect(()=>{
    if(finished && AUTO_REDIRECT){
      const t = setTimeout(()=>navigate('/login'), REDIRECT_DELAY_MS);
      return ()=>clearTimeout(t);
    }
  },[finished,navigate]);

  useEffect(()=>{
    if(cooldown<=0) return;
    const t=setInterval(()=>setCooldown(c=>c>0?c-1:0),1000);
    return ()=>clearInterval(t);
  },[cooldown]);

  const onChange=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));

  const start = async (e)=>{
    e.preventDefault();
    setErr(''); setMsg('');
  if(!form.username||!form.registrationKey.trim()||!form.fullName.trim()||!form.email||!form.phone){setErr('All fields required');return;}
  if(!accepted){setErr('You must accept Terms & Refund Policy');return;}
    setLoading(true);
    try{
      const res=await fetch(url.registrationStart(),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          username:form.username.trim(),
          registrationKey:form.registrationKey.trim(),
          fullName:form.fullName.trim(),
          email:form.email.trim(),
          phone:form.phone.trim()
        }),
        credentials: FETCH_CREDENTIALS
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) {
        const serverMsg = (data.error || data.message || '').toString();
        if (res.status === 429 && data.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
          setErr(serverMsg);
        } else if (res.status === 409 || /already\s*(registered|exists)|duplicate|user\s*exists/i.test(serverMsg)) {
          // If backend indicates the user already exists, show friendly message
          setErr('Already registered — please login.');
        } else if (res.status === 403) {
          setErr('Invalid registration key. Please check with the property owner.');
        } else {
          throw new Error(data.error||'Failed to start');
        }
        return;
      }
      setMsg('OTP sent to email. Enter OTP & set password.');
      setStep(2);
    }catch(e2){setErr(e2.message);}finally{setLoading(false);}
  };

  const finish = async (e)=>{
    e.preventDefault();
    setErr(''); setMsg('');
    if(!form.otp||!form.password){setErr('OTP & password required');return;}
    if(form.password!==form.confirmPassword){setErr('Passwords do not match');return;}
    setLoading(true);
    try{
      const res=await fetch(url.registrationFinish(),{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          username:form.username.trim(),
          otp:form.otp.trim(),
          password:form.password
        }),
        credentials: FETCH_CREDENTIALS
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||'Failed to finish');
      setMsg('Registration complete! Redirecting to login...');
      setFinished(true);
    }catch(e2){setErr(e2.message);}finally{setLoading(false);}
  };

  const boxStyle={
    maxWidth:420,margin:'50px auto',background:'#f8fafc',padding:32,
    borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',position:'relative'
  };
  const inputStyle={
    width:'100%',padding:10,marginBottom:14,border:'1px solid #cbd5e1',
    borderRadius:6,fontSize:15,background:'#fff'
  };
  const btnStyle={
    width:'100%',padding:12,background:'linear-gradient(90deg,#2563eb,#38bdf8)',
    color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',fontSize:16,
    cursor:loading?'not-allowed':'pointer',opacity:loading?0.65:1
  };
  const smallBtn={
    position:'absolute',top:10,right:10,
    background:'#e2e8f0',border:'none',padding:'6px 12px',
    borderRadius:6,cursor:'pointer',fontSize:12,color:'#2563eb',fontWeight:600
  };

  return (
    <div style={boxStyle}>
      <button onClick={()=>navigate('/login')} style={smallBtn}>Back to Login</button>
      <h2 style={{textAlign:'center',color:'#2563eb',marginBottom:24}}>
        Tenant Registration
      </h2>
      {err && <div style={{color:'red',marginBottom:12,textAlign:'center'}}>
        {cooldown>0 ? `Please wait ${cooldown}s before requesting another OTP.` : err}
      </div>}
      {msg && <div style={{color: finished ? '#166534':'green',marginBottom:12,textAlign:'center'}}>{msg}</div>}

      {!finished && step===1 && (
        <form onSubmit={start}>
          <input name="username" placeholder="Username (from admin)"
                 value={form.username} onChange={onChange} style={inputStyle}/>
          <input name="registrationKey" placeholder="Registration key (given by the owner)"
                 value={form.registrationKey} onChange={onChange} style={inputStyle}/>
          <input name="fullName" placeholder="Full name (as on your ID)"
                 value={form.fullName} onChange={onChange} style={inputStyle}/>
          <input name="email" type="email" placeholder="Email"
                 value={form.email} onChange={onChange} style={inputStyle}/>
          <input name="phone" type="tel" inputMode="numeric" placeholder="Mobile number (10 digits)"
                 value={form.phone} onChange={onChange} style={inputStyle}/>
          <label style={{display:'flex',alignItems:'flex-start',fontSize:12,lineHeight:1.4,color:'#334155',marginBottom:14}}>
            <input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} style={{marginRight:8,marginTop:2}} />
            <span>I agree to the <Link to="/terms" style={{color:'#2563eb',fontWeight:600}}>Terms & Conditions</Link> and the <Link to="/refund-policy" style={{color:'#2563eb',fontWeight:600}}>Cancellation & Refund Policy</Link>.</span>
          </label>
          <button type="submit" disabled={loading || cooldown>0} style={{...btnStyle, cursor:(loading||cooldown>0)?'not-allowed':'pointer', opacity:(loading||cooldown>0)?0.65:1}}>
            {loading?'Submitting...':cooldown>0?`Wait ${cooldown}s`:'Send OTP'}
          </button>
        </form>
      )}

      {!finished && step===2 && (
        <form onSubmit={finish}>
          <input disabled value={form.username} style={inputStyle}/>
          <input name="otp" placeholder="OTP" value={form.otp}
                 onChange={onChange} style={inputStyle}/>
          <input name="password" type="password" placeholder="Password"
                 value={form.password} onChange={onChange} style={inputStyle}/>
          <input name="confirmPassword" type="password" placeholder="Confirm Password"
                 value={form.confirmPassword} onChange={onChange} style={inputStyle}/>
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading?'Submitting...':'Complete Registration'}
          </button>
        </form>
      )}

      {finished && (
        <div style={{textAlign:'center'}}>
          <button onClick={()=>navigate('/login')} style={{...btnStyle,width:'100%',opacity:1}}>
            Go to Login Now
          </button>
          {AUTO_REDIRECT && <div style={{marginTop:12,fontSize:12,color:'#475569'}}>
            Redirecting automatically...
          </div>}
          <div style={{marginTop:20,fontSize:12,color:'#64748b'}}>
            Need to review? <Link to="/terms" style={{color:'#2563eb'}}>Terms</Link> | <Link to="/refund-policy" style={{color:'#2563eb'}}>Refund Policy</Link>
          </div>
        </div>
      )}
    </div>
  );
}