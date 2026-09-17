import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, API_PREFIX } from './apiClient';

const API = `${API_BASE}${API_PREFIX}/users`;
const AUTO_REDIRECT = true;
const REDIRECT_DELAY_MS = 2000;

export default function ForgotReset() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username:'', otp:'', newPassword:'', confirm:'' });
  const [loading,setLoading]=useState(false);
  const [resendLoading,setResendLoading]=useState(false);
  const [cooldown,setCooldown]=useState(0);
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [finished,setFinished]=useState(false);

  useEffect(()=>{
    if(finished && AUTO_REDIRECT){
      const t=setTimeout(()=>navigate('/login'),REDIRECT_DELAY_MS);
      return ()=>clearTimeout(t);
    }
  },[finished,navigate]);

  // Cooldown ticker for resend button
  useEffect(()=>{
    if(cooldown<=0) return;
    const t=setInterval(()=>setCooldown(c=>c>0?c-1:0),1000);
    return ()=>clearInterval(t);
  },[cooldown]);

  const onChange=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));

  const sendOtp=async e=>{
    e.preventDefault(); setErr(''); setMsg('');
    if(!form.username){setErr('Username required');return;}
    setLoading(true);
    try{
      const res=await fetch(`${API}/forgot-password`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:form.username.trim()})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) {
        if (res.status === 429 && data.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
          setStep(2);
        }
        throw new Error(data.error||'Failed');
      }
      setMsg('OTP sent to registered email.');
      setStep(2);
      setCooldown(60); // start 1-minute cooldown right after first send
    }catch(e2){setErr(e2.message);}finally{setLoading(false);}
  };

  const reset=async e=>{
    e.preventDefault(); setErr(''); setMsg('');
    if(!form.otp||!form.newPassword){setErr('All fields required');return;}
    if(form.newPassword!==form.confirm){setErr('Passwords mismatch');return;}
    setLoading(true);
    try{
      const res=await fetch(`${API}/reset-password`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          username:form.username.trim(),
          otp:form.otp.trim(),
          newPassword:form.newPassword
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||'Failed');
      setMsg('Password reset successful! Redirecting to login...');
      setFinished(true);
    }catch(e2){setErr(e2.message);}finally{setLoading(false);}
  };

  const resendOtp = async () => {
    setErr(''); setMsg('');
    if(!form.username){ setErr('Username required'); return; }
    if(cooldown>0 || resendLoading || loading) return;
    setResendLoading(true);
    try{
      const res=await fetch(`${API}/forgot-password`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:form.username.trim()})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) {
        if (res.status === 429 && data.retryAfterSeconds) {
          setCooldown(data.retryAfterSeconds);
        }
        throw new Error(data.error||'Failed');
      }
      setMsg('OTP resent to registered email.');
      setCooldown(60); // 60s cooldown to avoid spam
    }catch(e2){
      setErr(e2.message||'Something went wrong. Please try again.');
    }finally{
      setResendLoading(false);
    }
  };

  const box={maxWidth:420,margin:'50px auto',background:'#f8fafc',padding:32,borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,.08)',position:'relative'};
  const input={width:'100%',padding:10,marginBottom:14,border:'1px solid #cbd5e1',borderRadius:6,fontSize:15,background:'#fff'};
  const btn={width:'100%',padding:12,background:'linear-gradient(90deg,#2563eb,#38bdf8)',color:'#fff',border:'none',borderRadius:6,fontWeight:'bold',fontSize:16,cursor:loading?'not-allowed':'pointer',opacity:loading?0.65:1};
  const smallBtn={position:'absolute',top:10,right:10,background:'#e2e8f0',border:'none',padding:'6px 12px',borderRadius:6,cursor:'pointer',fontSize:12,color:'#2563eb',fontWeight:600};
  const resendBtnBase={padding:'8px 12px',background:'#eff6ff',border:'1px solid #93c5fd',borderRadius:6,color:'#1d4ed8',fontWeight:600};
  const resendDisabledStyle=(resendLoading||cooldown>0||loading)?{cursor:'not-allowed',opacity:0.6}:{cursor:'pointer',opacity:1};
  const fmt=(s)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div style={box}>
      <button onClick={()=>navigate('/login')} style={smallBtn}>Back to Login</button>
      <h2 style={{textAlign:'center',color:'#2563eb',marginBottom:24}}>Forgot Password</h2>
      {err && <div style={{color:'red',marginBottom:12,textAlign:'center'}}>{err}</div>}
      {msg && <div style={{color: finished ? '#166534':'green',marginBottom:12,textAlign:'center'}}>{msg}</div>}

      {!finished && step===1 && (
        <form onSubmit={sendOtp}>
          <input name="username" placeholder="Username"
                 value={form.username} onChange={onChange} style={input}/>
          <button style={btn} type="submit" disabled={loading}>
            {loading?'Sending...':'Send OTP'}
          </button>
        </form>
      )}

      {!finished && step===2 && (
        <form onSubmit={reset}>
          <input disabled value={form.username} style={input}/>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input name="otp" placeholder="OTP" value={form.otp} onChange={onChange} style={{...input,marginBottom:0}}/>
            <button type="button" onClick={resendOtp}
                    style={{...resendBtnBase,...resendDisabledStyle}}
                    disabled={resendLoading || cooldown>0 || loading}>
              {resendLoading ? 'Resending...' : (cooldown>0 ? `Resend (${fmt(cooldown)})` : 'Resend OTP')}
            </button>
          </div>
          <div style={{fontSize:12,color:'#64748b',margin:'6px 0 8px'}}>
            {cooldown>0 ? `You can resend OTP in ${fmt(cooldown)}.` : 'You can resend the OTP now.'}
          </div>
          <input name="newPassword" type="password" placeholder="New Password" value={form.newPassword} onChange={onChange} style={input}/>
          <input name="confirm" type="password" placeholder="Confirm Password" value={form.confirm} onChange={onChange} style={input}/>
          <button style={btn} type="submit" disabled={loading}>
            {loading?'Resetting...':'Reset Password'}
          </button>
        </form>
      )}

      {finished && (
        <div style={{textAlign:'center'}}>
          <button onClick={()=>navigate('/login')} style={{...btn,width:'100%',opacity:1}}>
            Go to Login Now
          </button>
          {AUTO_REDIRECT && <div style={{marginTop:12,fontSize:12,color:'#475569'}}>
            Redirecting automatically...
          </div>}
        </div>
      )}
    </div>
  );
}