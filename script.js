/* =========================================================
   ENDPOINTS
========================================================= */
const ENDPOINTS = {
  A: { label:'User A', ip:'192.168.1.100', port:'40000', icon:'☎️' },
  B: { label:'User B', ip:'192.168.1.200', port:'50000', icon:'☎️' },
  C: { label:'User C', ip:'192.168.1.210', port:'55000', icon:'☎️' },
  P: { label:'PBX / SBC / Proxy', ip:'10.0.0.1', port:'5060', icon:'🖥️' },
  F: { label:'Conference Focus', ip:'10.0.0.50', port:'5060', icon:'🎛️' },
  X: { label:'Carrier / SIP Trunk', ip:'203.0.113.10', port:'5060', icon:'🌐' },
  X2: { label:'Carrier / SIP Trunk (secondary)', ip:'203.0.113.20', port:'5060', icon:'🌐' },
  P2: { label:'Proxy 2 (misrouted)', ip:'10.0.0.2', port:'5060', icon:'🖥️' },
  CP1: { label:'PBX #1', ip:'10.1.0.1', port:'5060', icon:'🖥️' },
  CP2: { label:'PBX #2', ip:'10.1.0.2', port:'5060', icon:'🖥️' },
  CP3: { label:'PBX #3', ip:'10.1.0.3', port:'5060', icon:'🖥️' },
  CFW: { label:'Firewall', ip:'10.2.0.1', port:'5060', icon:'🧱' },
  PS: { label:'Presence Server', ip:'10.0.0.20', port:'5060', icon:'💡' },
  STUN: { label:'STUN Server', ip:'198.51.100.10', port:'3478', icon:'🧊' },
  TURN: { label:'TURN Relay Server', ip:'198.51.100.20', port:'3478', icon:'🔁' },
  X2: { label:'Carrier / SIP Trunk (Secondary)', ip:'203.0.113.20', port:'5060', icon:'🌐' }
};

const PLAIN = {
  INVITE:'One side is asking to start a call, or, mid-call, asking to change something about it.',
  CANCEL:'Giving up on a call attempt that has not been answered yet.',
  ACK:'Confirms the final response was received — the request is now fully complete.',
  BYE:'One side is ending the call.',
  REFER:'Asking the other party to place a call to someone else, on your behalf.',
  INFO:'Sending extra information during an active call, such as a pressed keypad digit.',
  PRACK:'Confirming that a reliable provisional response was received.',
  NOTIFY:'Reporting progress on something requested earlier, such as a transfer.',
  UPDATE:'Updating session details before the call has been answered.',
  '100':'A device along the way confirms it received the request, so the sender stops resending it.',
  '180':'The phone is ringing on the other end.',
  '182':'The call is being held in a queue before it can be answered.',
  '183':'Early progress is reported back — sometimes with audio like ringback tone — before anyone answers.',
  '200':'The request succeeded.',
  '202':'The request has been accepted and is being processed.',
  '302':'The server redirects the call to a different destination.',
  '486':'The person is busy on another call.',
  '487':'The original call attempt was ended before it was answered.'
};

function sig(dir, method, extra){ return Object.assign({kind:'signal', dir, method}, extra||{}); }
function media(pairs, label, ms, extra){ return Object.assign({kind:'media', pairs, label, duration:ms}, extra||{}); }
function wait(at, label, ms, extra){ return Object.assign({kind:'wait', at, label, duration:ms}, extra||{}); }

/* =========================================================
   SCENARIOS
========================================================= */
const SCENARIO_TEMPLATES = {

  standard:{ name:'Basic Call Setup', category:'core', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111 0 8', codecs:['opus/48000/2 (111)','PCMU/8000 (0)']}, note:'SDP offer advertises supported codecs.', plain:'User A calls User B and proposes which audio formats it can use.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{note:'Proxy forwards the invitation to User B.'}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111) — accepted']}, note:'SDP answer — Opus is selected from the offer.', plain:'User B answers and confirms which audio codec will be used.'}),
    sig('P>A','200 OK',{code:200, note:'Answer relayed back to User A.'}),
    sig('A>B','ACK',{direct:true, note:'Sent straight to the Contact address — dialog is now CONFIRMED.'}),
    media([['A','B']],'RTP / RTCP — Opus 48kHz',42000,{note:'Peer-to-peer, bypassing the proxy. RTCP carries jitter / loss / round-trip stats.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true, note:'Sockets released, media stops.'})
  ]},

  hold:{ name:'Call Hold / Resume', category:'core', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111)']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111)']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — active',9000,{}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE', sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['a=sendonly']}, plain:'User A asks to put the call on hold — it will only send audio, not receive it.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['a=recvonly']}, plain:'User B agrees to the hold — it will only receive audio, not send it.'}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'MOH — one-way (hold)',10000,{held:true, plain:'User A hears music-on-hold. No audio actually flows toward User B while the call is held.'}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (resume)', sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['a=sendrecv']}, plain:'User A asks to take the call off hold and resume two-way audio.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['a=sendrecv']}}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP / RTCP — resumed',20000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  prack:{ name:'PRACK (Reliable Provisional)', category:'core', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['Supported: 100rel'], sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111)']}, plain:'User A calls User B and says it can handle reliable provisional responses.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','183 Session Progress',{code:183, extraHeaders:['Require: 100rel','RSeq: 1'], sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['early media — ringback tone']}, plain:'User B sends early media (like a ringback tone) and asks for reliable delivery of this response.'}),
    sig('P>A','183 Session Progress',{code:183}),
    sig('A>B','PRACK',{direct:true, extraHeaders:['RAck: 1 1 INVITE'], plain:'User A confirms it received the 183 response, as requested.'}),
    sig('B>A','200 OK',{code:200, direct:true, note:'Response to the PRACK, not to the INVITE itself.'}),
    sig('B>A','180 Ringing',{code:180, direct:true}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111) — final answer']}}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP / RTCP — Opus',18000,{note:'The caller already heard ringback during the 183 stage, before this point.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  attransfer:{ name:'Attended Transfer', category:'transfer', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls User B.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',8000,{}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (hold B)', sdp:{c:'', m:'', codecs:['a=sendonly']}, plain:'User A puts User B on hold to consult with User C first.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=recvonly']}}),
    sig('A>C','INVITE',{callId:'consult-9f21@192.168.1.100', firstRequest:true, plain:'User A calls User C to ask if they will take the call.'}),
    sig('C>A','200 OK',{code:200, callId:'consult-9f21@192.168.1.100'}),
    sig('A>C','ACK',{callId:'consult-9f21@192.168.1.100'}),
    media([['A','C']],'RTP — A ⇄ C (consult)',8000,{note:'A briefs C before completing the transfer.'}),
    sig('A>B','REFER',{direct:true, extraHeaders:['Refer-To: <sip:userC@domain.com?Replaces=consult-9f21%40192.168.1.100>','Referred-By: <sip:userA@domain.com>'], plain:'User A asks User B to call User C directly, and to replace the A↔C consultation call once connected.'}),
    sig('B>A','202 Accepted',{code:202, direct:true}),
    sig('B>C','INVITE',{callId:'consult-9f21@192.168.1.100', extraHeaders:['Replaces: consult-9f21@192.168.1.100'], plain:'User B calls User C directly, referencing the earlier consultation dialog.'}),
    sig('C>B','200 OK',{code:200, callId:'consult-9f21@192.168.1.100'}),
    sig('B>C','ACK',{callId:'consult-9f21@192.168.1.100'}),
    sig('B>A','NOTIFY',{direct:true, extraHeaders:['Event: refer','Content-Type: message/sipfrag'], body:'SIP/2.0 200 OK', plain:'User B reports back to User A that the transfer succeeded.'}),
    sig('A>B','200 OK',{code:200, direct:true}),
    media([['B','C']],'RTP — B ⇄ C (transferred)',10000,{note:'The call is now anchored between B and C.'}),
    sig('A>B','BYE',{direct:true, teardown:true, plain:'User A leaves the call — the transfer is complete.'}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  blindtransfer:{ name:'Blind (Unattended) Transfer', category:'transfer', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',7000,{}),
    sig('A>B','REFER',{direct:true, extraHeaders:['Refer-To: <sip:userC@domain.com>','Referred-By: <sip:userA@domain.com>'], plain:'User A asks User B to call User C — with no consultation call and no Replaces header, unlike an attended transfer.'}),
    sig('B>A','202 Accepted',{code:202, direct:true}),
    sig('B>C','INVITE',{firstRequest:true, plain:'User B calls User C cold — User C has no idea a transfer is happening yet.'}),
    sig('C>B','200 OK',{code:200}),
    sig('B>C','ACK',{}),
    sig('B>A','NOTIFY',{direct:true, extraHeaders:['Event: refer','Content-Type: message/sipfrag'], body:'SIP/2.0 200 OK', plain:'User B reports back that User C answered.'}),
    sig('A>B','200 OK',{code:200, direct:true}),
    media([['B','C']],'RTP — B ⇄ C (transferred)',9000,{}),
    sig('A>B','BYE',{direct:true, teardown:true, plain:'User A leaves immediately — it never spoke to User C.'}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  semitransfer:{ name:'Semi-Attended Transfer', category:'transfer', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',6000,{}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (hold B)', sdp:{c:'', m:'', codecs:['a=sendonly']}, plain:'User A holds User B to start dialing User C.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=recvonly']}}),
    sig('A>C','INVITE',{callId:'consult-semi@192.168.1.100', firstRequest:true, plain:'User A starts calling User C.'}),
    sig('C>A','180 Ringing',{code:180, callId:'consult-semi@192.168.1.100', plain:'User C’s phone starts ringing — User A does not wait for an answer.'}),
    sig('A>B','REFER',{direct:true, extraHeaders:['Refer-To: <sip:userC@domain.com?Replaces=consult-semi%40192.168.1.100>'], plain:'Before C even answers, User A asks User B to take over the still-ringing call — this is what makes it “semi-attended” rather than fully attended (which waits for an answer) or blind (which never calls C from A at all).'}),
    sig('B>A','202 Accepted',{code:202, direct:true}),
    sig('B>C','INVITE',{callId:'consult-semi@192.168.1.100', extraHeaders:['Replaces: consult-semi@192.168.1.100'], plain:'User B calls User C directly, referencing the still-ringing consultation dialog — this automatically supersedes User A’s pending attempt.'}),
    sig('C>B','200 OK',{code:200, callId:'consult-semi@192.168.1.100'}),
    sig('B>C','ACK',{callId:'consult-semi@192.168.1.100'}),
    sig('B>A','NOTIFY',{direct:true, extraHeaders:['Event: refer','Content-Type: message/sipfrag'], body:'SIP/2.0 200 OK', plain:'User B reports back that the transfer succeeded.'}),
    sig('A>B','200 OK',{code:200, direct:true}),
    media([['B','C']],'RTP — B ⇄ C (transferred)',9000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  cfu:{ name:'Forwarding — Unconditional', category:'forwarding', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls User B.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>P','CFU Lookup',{code:'', method:'CFU Lookup', label:'⚙ Forwarding rule check', note:"Proxy checks User B's profile: Call Forward Unconditional → User C.", plain:"Before ringing User B at all, the server sees B has unconditional forwarding turned on, aimed at User C."}),
    sig('P>C','INVITE',{extraHeaders:['Diversion: <sip:userB@domain.com>;reason=unconditional'], plain:'The proxy sends the call straight to User C instead, tagging it as forwarded from User B.'}),
    sig('C>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('C>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>C','ACK',{direct:true}),
    media([['A','C']],'RTP — A ⇄ C',16000,{}),
    sig('A>C','BYE',{direct:true, teardown:true}),
    sig('C>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  cfb:{ name:'Forwarding — Busy', category:'forwarding', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{plain:"User A's call is tried at User B first."}),
    sig('B>P','486 Busy Here',{code:486, recovered:true, plain:'User B is already on another call and rejects the new one.'}),
    sig('P>P','CFB Lookup',{code:'', method:'CFB Lookup', label:'⚙ Forwarding rule check', note:"Proxy checks User B's profile: Call Forward Busy → User C.", plain:'Since B is busy, the server now redirects the call to C instead.'}),
    sig('P>C','INVITE',{extraHeaders:['Diversion: <sip:userB@domain.com>;reason=user-busy'], plain:'The call reaches User C, tagged as forwarded because User B was busy.'}),
    sig('C>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('C>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>C','ACK',{direct:true}),
    media([['A','C']],'RTP — A ⇄ C',14000,{}),
    sig('A>C','BYE',{direct:true, teardown:true}),
    sig('C>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  cfna:{ name:'Forwarding — No Answer', category:'forwarding', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    wait('B','No-answer timer',9000,{note:"B's phone keeps ringing, unanswered, until the no-answer timer expires (commonly ~15–20s).", plain:'The system waits to see if User B will pick up before deciding what to do next.'}),
    sig('P>B','CANCEL',{plain:'The server gives up on ringing User B.'}),
    sig('B>P','200 OK',{code:200, cseqOverride:{num:1,method:'CANCEL'}, note:'Response to the CANCEL.'}),
    sig('B>P','487 Request Terminated',{code:487, recovered:true, cseqOverride:{num:1,method:'INVITE'}, note:'Final response to the original, now-cancelled INVITE.'}),
    sig('P>B','ACK',{note:'ACK for the non-2xx final response.'}),
    sig('P>P','CFNA Lookup',{code:'', method:'CFNA Lookup', label:'⚙ Forwarding rule check', note:"Proxy checks User B's profile: Call Forward No Answer → User C.", plain:"Since B never answered, the server now sends the call to User C."}),
    sig('P>C','INVITE',{extraHeaders:['Diversion: <sip:userB@domain.com>;reason=no-answer']}),
    sig('C>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('C>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>C','ACK',{direct:true}),
    media([['A','C']],'RTP — A ⇄ C',12000,{}),
    sig('A>C','BYE',{direct:true, teardown:true}),
    sig('C>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  forward302:{ name:'Forwarding — 3xx Redirect', category:'forwarding', endpoints:['A','P','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls a number that has been redirected.'}),
    sig('P>A','302 Moved Temporarily',{code:302, extraHeaders:['Contact: <sip:userC@domain.com>'], note:'Unlike proxy-level forwarding, the server does not forward this call itself — it hands back a new address and steps out of the picture.', plain:'The server tells User A directly, “try this other address instead,” rather than trying it on A’s behalf.'}),
    sig('A>P','ACK',{note:'Acknowledges the final response.'}),
    sig('A>C','INVITE',{firstRequest:true, plain:'User A itself places a brand-new call to the address it was given.'}),
    sig('C>A','180 Ringing',{code:180}),
    sig('C>A','200 OK',{code:200}),
    sig('A>C','ACK',{}),
    media([['A','C']],'RTP — A ⇄ C',12000,{}),
    sig('A>C','BYE',{teardown:true}),
    sig('C>A','200 OK',{code:200, teardown:true})
  ]},

  cfdnd:{ name:'Forwarding — Do Not Disturb', category:'forwarding', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls User B.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>P','DND Lookup',{code:'', method:'DND Lookup', label:'⚙ Forwarding rule check', note:'Proxy checks User B’s profile: Do Not Disturb is enabled → forward to User C.', plain:'User B has turned on Do Not Disturb, so the server never even attempts to ring B — the call is redirected instantly.'}),
    sig('P>C','INVITE',{extraHeaders:['Diversion: <sip:userB@domain.com>;reason=do-not-disturb']}),
    sig('C>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('C>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>C','ACK',{direct:true}),
    media([['A','C']],'RTP — A ⇄ C',12000,{}),
    sig('A>C','BYE',{direct:true, teardown:true}),
    sig('C>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  adhocconf:{ name:'Ad-Hoc Conference (Local Mix)', category:'multiparty', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls User B.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',6000,{}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (hold B)', sdp:{c:'', m:'', codecs:['a=sendonly']}, plain:'User A holds User B to start a second call.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=recvonly']}}),
    sig('A>C','INVITE',{callId:'leg2-c@192.168.1.100', firstRequest:true, plain:'User A calls User C, the third participant.'}),
    sig('C>A','200 OK',{code:200, callId:'leg2-c@192.168.1.100'}),
    sig('A>C','ACK',{callId:'leg2-c@192.168.1.100'}),
    media([['A','C']],'RTP — A ⇄ C',6000,{}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (resume, join)', sdp:{c:'', m:'', codecs:['a=sendrecv']}, plain:"User A presses “Conference” — its device will now mix both legs' audio together."}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=sendrecv']}}),
    media([['A','B'],['A','C']],'3-way local mix at User A',18000,{mixAt:'A', note:"User A's device mixes B and C's audio and forwards the blend to each — B and C never talk directly to each other.", plain:'All three people can now hear each other, but every audio stream physically passes through User A.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true}),
    sig('A>C','BYE',{direct:true, teardown:true, callId:'leg2-c@192.168.1.100'}),
    sig('C>A','200 OK',{code:200, direct:true, teardown:true, callId:'leg2-c@192.168.1.100'})
  ]},

  meetmeconf:{ name:'Meet-Me Conference (Focus/MCU)', category:'multiparty', endpoints:['A','B','C','F'], steps:[
    sig('A>F','INVITE',{firstRequest:true, plain:'User A dials the conference bridge number.'}),
    sig('F>A','200 OK',{code:200}),
    sig('A>F','ACK',{}),
    media([['A','F']],'RTP — A ⇄ Focus',4000,{}),
    sig('B>F','INVITE',{firstRequest:true, plain:'User B dials into the same conference.'}),
    sig('F>B','200 OK',{code:200}),
    sig('B>F','ACK',{}),
    sig('C>F','INVITE',{firstRequest:true, plain:'User C dials in too.'}),
    sig('F>C','200 OK',{code:200}),
    sig('C>F','ACK',{}),
    media([['A','F'],['B','F'],['C','F']],'Focus mixes 3 legs',20000,{mixAt:'F', note:'The Focus server (MCU) mixes all participants and sends each one a personalized mix that excludes their own voice.', plain:'The conference bridge itself does all the audio mixing — nobody talks to anyone else directly.'}),
    sig('A>F','BYE',{direct:true, teardown:true, plain:'User A leaves — the conference continues for B and C.'}),
    sig('F>A','200 OK',{code:200, direct:true, teardown:true}),
    media([['B','F'],['C','F']],'Focus mixes 2 legs',6000,{mixAt:'F'}),
    sig('B>F','BYE',{direct:true, teardown:true}),
    sig('F>B','200 OK',{code:200, direct:true, teardown:true}),
    sig('C>F','BYE',{direct:true, teardown:true}),
    sig('F>C','200 OK',{code:200, direct:true, teardown:true})
  ]},

  callwaiting:{ name:'Call Waiting', category:'multiparty', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls User B and they connect.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',6000,{}),
    sig('C>B','INVITE',{firstRequest:true, plain:'While B is on the call with A, User C tries to call B too.'}),
    sig('B>C','180 Ringing',{code:180, note:"B's phone plays a call-waiting tone locally — this is a device behavior, not a separate SIP message.", plain:"User B hears a quiet beep in the current call, signaling someone else is calling."}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (hold A)', sdp:{c:'', m:'', codecs:['a=sendonly']}, note:"B's device puts the A leg on hold to answer C.", plain:'User B holds the call with A to go answer User C.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=recvonly']}}),
    sig('B>C','200 OK',{code:200, plain:'User B answers User C.'}),
    sig('C>B','ACK',{}),
    media([['B','C']],'RTP — B ⇄ C',10000,{note:'A now hears hold music while B talks to C — B can flip back anytime, just like Call Hold.'}),
    sig('B>C','BYE',{teardown:true}),
    sig('C>B','200 OK',{code:200, teardown:true}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (resume A)', sdp:{c:'', m:'', codecs:['a=sendrecv']}}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'', m:'', codecs:['a=sendrecv']}}),
    media([['A','B']],'RTP — A ⇄ B (resumed)',8000,{})
  ]},

  fax:{ name:'T.38 Fax Relay', category:'faxdtmf', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, plain:'A fax machine behind User A dials User B, starting as a normal voice call.'}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — G.711 audio',3000,{note:"B's fax machine detects the incoming CED tone that signals a fax transmission."}),
    sig('B>A','INVITE',{direct:true, label:'re-INVITE (switch to T.38)', sdp:{c:'IN IP4 192.168.1.200', m:'image 0 udptl t38', codecs:['T.38 fax relay']}, plain:"User B's gateway asks to switch this call from audio to fax image data."}),
    sig('A>B','200 OK',{code:200, direct:true, sdp:{c:'IN IP4 192.168.1.100', m:'image 0 udptl t38', codecs:['T.38 fax relay — accepted']}}),
    sig('B>A','ACK',{direct:true}),
    media([['A','B']],'UDPTL — T.38 fax image',16000,{note:'T.30 fax signaling and page image data are now relayed over UDPTL instead of RTP.', plain:'The actual fax pages transfer now, using a data format built for reliability instead of real-time audio.'}),
    sig('A>B','BYE',{direct:true, teardown:true, plain:'The fax finishes and the call ends.'}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  dtmf2833:{ name:'DTMF — RFC 4733 (RTP Events)', category:'faxdtmf', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['a=rtpmap:101 telephone-event/8000'], plain:'The call starts normally; both sides also agree to support a special RTP payload type just for keypad digits.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — audio',5000,{}),
    sig('A>B','RTP Event',{direct:true, rtpEvent:true, label:'RTP Event — digit "5"', note:'Carried as an RTP packet with payload type 101 (telephone-event), not a SIP message.', plain:'The digit "5" is carried as a special marker inside the audio stream itself. This is the modern, most reliable way to send touch-tone digits.', rtpPacket:'RTP Header\n  Payload Type: 101 (telephone-event)\n  Sequence / Timestamp: continues the audio stream\nEvent Payload\n  Event: 5\n  End-of-Event (E) bit: 1\n  Volume: 10\n  Duration: 160 (in 20ms increments)'}),
    media([['A','B']],'RTP — audio',5000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  dtmfinfo:{ name:'DTMF — SIP INFO', category:'faxdtmf', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — audio',5000,{}),
    sig('A>B','INFO',{direct:true, contentType:'application/dtmf-relay', body:'Signal=5\r\nDuration=160', plain:'The digit "5" is sent as its own separate mid-call message, with a short text body describing which key and for how long.'}),
    sig('B>A','200 OK',{code:200, direct:true, note:'Acknowledges receipt of the digit.'}),
    media([['A','B']],'RTP — audio',5000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  dtmfinband:{ name:'DTMF — In-Band (Audio)', category:'faxdtmf', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — audio',6000,{}),
    media([['A','B']],'RTP — audio tone: digit "5"',7000,{note:'No separate signaling message exists for this digit at all.', plain:'The digit "5" is generated as an audible dual-tone (DTMF) sound and mixed directly into the normal voice audio. The far end — a phone or an IVR — has to listen to the audio itself and detect the tone. This is the oldest method and the least reliable over compressed or lossy links.'}),
    media([['A','B']],'RTP — audio',5000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  delayedoffer:{ name:'Delayed Offer', category:'core', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, note:'No SDP body is included in this INVITE at all.', plain:'User A starts the call without proposing any media yet — it asks User B to make the first offer instead.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111)']}, plain:'Since A never offered anything, User B supplies the SDP offer itself, inside the 200 OK.'}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111) — answer']}, plain:'User A completes the negotiation by putting its SDP answer inside the ACK itself.'}),
    media([['A','B']],'RTP / RTCP — Opus',14000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  secure:{ name:'Secure Call — TLS + SRTP', category:'core', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['(carried over TLS — sips: scheme)'], sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/SAVP 111', codecs:['crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<key material>']}, plain:'User A starts a secure call — the signaling itself travels over an encrypted TLS connection, and the offered media uses SRTP instead of plain RTP.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/SAVP 111', codecs:['crypto:1 AES_CM_128_HMAC_SHA1_80 inline:<key material> — accepted']}, note:'Both sides now share the key material needed to encrypt and authenticate the media.'}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'SRTP — encrypted audio',16000,{note:'Every RTP packet is now encrypted and authenticated — a passive eavesdropper on the network sees only ciphertext.', plain:'The voice audio is now scrambled with the shared key, so it cannot be listened to just by capturing packets off the network.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  notfound404:{ name:'404 Not Found', category:'errors', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls a number that turns out not to exist in the system.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>A','404 Not Found',{code:404, note:'The proxy cannot find any registered user or route matching the request.', plain:'The server looked up the destination and found nobody registered under that address.', fix:'Start by confirming the dialed number or URI is actually correct — a single typo or an extra/missing digit is the most common cause. If the number looks right, check the destination\u2019s registration status on the PBX/registrar (an unregistered device produces exactly this error), look for a recently deleted or renumbered extension, and confirm the dial plan or routing table has a matching entry for this pattern. For calls to external numbers, verify the carrier trunk\u2019s DID range actually includes this number.', rootCause:['User A dialed an address the server has no route for','Location/registration lookup returned no match','Server declines the request with 404 Not Found','Call never reaches any destination']}),
    sig('A>P','ACK',{note:'Acknowledges the final non-2xx response.'})
  ]},

  codecmismatch488:{ name:'488 Codec Mismatch', category:'errors', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 8', codecs:['PCMA/8000 (8) — only codec offered']}, plain:'User A offers only a single audio codec.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','488 Not Acceptable Here',{code:488, note:'User B cannot support any codec in the offer.', plain:'User B’s device does not support the one codec that was offered, so it cannot build a media session.', fix:'Compare each side\u2019s codec list directly: check what User A\u2019s device or trunk is configured to offer, and what User B\u2019s device actually supports, then find where they diverge. The quickest fix is usually adding a widely-supported fallback codec — G.711 (PCMU/PCMA) or Opus — to whichever side is too narrowly configured. If a single-codec offer like this is intentional (e.g. to force a specific codec for bandwidth reasons), make sure the receiving side is provisioned to match before rolling it out broadly.', rootCause:['User A’s SDP offer lists only PCMA (payload 8)','User B’s device does not have PCMA enabled','No codec appears in both the offer and B’s supported list','Offer/answer negotiation cannot complete — 488 returned']}),
    sig('P>A','488 Not Acceptable Here',{code:488}),
    sig('A>P','ACK',{})
  ]},

  busy486:{ name:'486 Busy Here', category:'errors', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','486 Busy Here',{code:486, plain:'The destination is already on another call and cannot take a second one.', fix:'A single 486 like this is normal telephony behavior, not a fault to chase down — User B genuinely has only one line and it\u2019s in use. If this is happening often for one user or hunt group, that\u2019s the actual signal worth acting on: check whether call waiting is enabled so a second call doesn\u2019t get flatly rejected, confirm a busy-forward (Call Forward Busy) rule is configured to send overflow calls to voicemail or a colleague, and check the device\u2019s max-simultaneous-calls setting in case it\u2019s set lower than intended.', rootCause:['User B’s line is already occupied by another active call','B’s device rejects the new INVITE outright','486 Busy Here is returned instead of ringing','New call attempt fails without ever alerting B']}),
    sig('P>A','486 Busy Here',{code:486}),
    sig('A>P','ACK',{})
  ]},

  cancel487:{ name:'CANCEL / 487', category:'errors', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('A>P','CANCEL',{plain:'User A hangs up before anyone answers.'}),
    sig('P>B','CANCEL',{note:'CANCEL must retrace the exact same path as the original INVITE.'}),
    sig('B>P','200 OK',{code:200, cseqOverride:{num:1,method:'CANCEL'}, note:'Response to the CANCEL.'}),
    sig('P>A','200 OK',{code:200, cseqOverride:{num:1,method:'CANCEL'}}),
    sig('B>P','487 Request Terminated',{code:487, cseqOverride:{num:1,method:'INVITE'}, note:'Final response to the now-cancelled INVITE.', plain:'The original call attempt is formally closed out, since it was cancelled before being answered.', fix:'A single CANCEL like this is completely normal — the caller simply hung up before anyone answered, and no fault occurred. It\u2019s only worth investigating if this pattern is unusually frequent for one destination or user: that can point at ring time being too long (callers giving up), a caller-ID or display-name issue causing hesitation to answer, or a UI that makes it too easy to place an accidental call.', rootCause:['User A ended the call attempt before it was answered','A CANCEL was sent for the still-ringing INVITE','B’s device stops alerting and closes the transaction','487 Request Terminated confirms the INVITE will not complete']}),
    sig('P>A','487 Request Terminated',{code:487, cseqOverride:{num:1,method:'INVITE'}}),
    sig('A>P','ACK',{note:'ACK for the non-2xx final response.'})
  ]},

  noanswer480:{ name:'480 No Answer', category:'errors', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    wait('B','No-answer timeout',8000,{note:'The phone keeps ringing with nobody picking up.'}),
    sig('B>P','480 Temporarily Unavailable',{code:480, note:'The device, or the network on its behalf, gives up waiting for an answer.', plain:'Nobody answered in time, so the call is given up as unreachable for now.', fix:'Occasional no-answers are just calls that were missed — but a pattern of them for one user is worth a closer look. Confirm the destination stayed registered for the whole ring duration (a device that drops registration mid-call will produce exactly this), check how long the no-answer timer is actually set to (too short cuts off legitimate answer time, too long frustrates callers), and confirm a forward-on-no-answer rule sends the call somewhere useful — voicemail or a colleague — instead of just failing outright.', rootCause:['B’s phone rings but nobody picks up','No-answer timer on the server expires','Server (or B) gives up on the pending INVITE','480 Temporarily Unavailable is returned to the caller']}),
    sig('P>A','480 Temporarily Unavailable',{code:480}),
    sig('A>P','ACK',{})
  ]},

  optionskeepalive:{ name:'OPTIONS / Keepalive', category:'methods', endpoints:['A','B'], steps:[
    sig('A>B','OPTIONS',{direct:true, firstRequest:true, plain:'User A checks whether User B is online and what it supports, without placing an actual call.'}),
    sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Allow: INVITE, ACK, BYE, CANCEL, OPTIONS, REFER, NOTIFY, INFO'], note:'No dialog or media is created — this is only a reachability and capability check.', plain:'User B confirms it is alive and lists which SIP methods it understands.'})
  ]},

  registerauth:{ name:'REGISTER + Digest Auth', category:'methods', endpoints:['A','P'], steps:[
    sig('A>P','REGISTER',{firstRequest:true, extraHeaders:['Contact: <sip:userA@192.168.1.100:5060>'], plain:'A phone tells the registrar where it can currently be reached.'}),
    sig('P>A','401 Unauthorized',{code:401, extraHeaders:['WWW-Authenticate: Digest realm="domain.com", nonce="…"'], note:'The registrar challenges the request for credentials before accepting it.', plain:'The server will not accept the registration yet — it wants proof of identity first.'}),
    sig('A>P','REGISTER',{label:'REGISTER (with credentials)', extraHeaders:['Authorization: Digest username="userA", realm="domain.com", response="…"'], plain:'The phone retries the same registration, this time including a computed digest response.'}),
    sig('P>A','200 OK',{code:200, extraHeaders:['Expires: 3600'], note:'The registrar now knows where to route calls for this user for the next hour.', plain:'Registration succeeds — incoming calls for User A will now be routed to this device.'})
  ]},

  codecbest:{ name:'Codec Negotiation — Best Match', category:'sdp', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111 9 0 8', codecs:['opus/48000/2 (111) — most preferred','G.722/8000 (9)','PCMU/8000 (0)','PCMA/8000 (8) — least preferred']}, plain:'User A offers four possible codecs, listed in order of preference.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 9', codecs:['G.722/8000 (9) — selected']}, note:'SIP/SDP negotiation is offer/answer: the answerer picks one option from what was offered — it cannot introduce a codec the offer never listed.', plain:'User B keeps only the one codec it wants to use — here, wideband G.722 — even though four were offered.'}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — G.722 wideband',14000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  codectranscode:{ name:'Codec Negotiation — Transcoding', category:'sdp', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 18', codecs:['G.729/8000 (18) — only codec offered']}, plain:'User A only supports the low-bandwidth G.729 codec.'}),
    sig('P>B','INVITE',{sdp:{c:'IN IP4 10.0.0.1', m:'audio 61000 RTP/AVP 0', codecs:['PCMU/8000 (0) — offered by the gateway']}, note:'The gateway re-originates the call toward B with its own codec list, since B does not support G.729 at all.', plain:'The media gateway offers User B a codec it knows B supports, standing in the middle of the negotiation.'}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('P>A','200 OK',{code:200, sdp:{c:'IN IP4 10.0.0.1', m:'audio 62000 RTP/AVP 18', codecs:['G.729/8000 (18) — accepted (transcoded)']}, note:'The gateway answers User A in G.729, as if it were B — neither side knows a codec conversion is happening in the middle.'}),
    sig('A>P','ACK',{}),
    media([['A','P'],['P','B']],'RTP — G.729 ⇄ transcoded ⇄ PCMU',16000,{note:'The gateway decodes G.729 from A and re-encodes it as PCMU toward B in real time, and vice versa — this costs CPU and adds a few milliseconds of delay.', plain:'Two separate media streams exist, using two different codecs, with the gateway converting between them continuously.'}),
    sig('A>P','BYE',{teardown:true}),
    sig('P>A','200 OK',{code:200, teardown:true})
  ]},

  codecrenegotiate:{ name:'Codec Renegotiation Mid-Call', category:'sdp', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 9', codecs:['G.722/8000 (9) — wideband']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 9', codecs:['G.722/8000 (9) — accepted']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — G.722 wideband',7000,{}),
    media([['A','B']],'RTP — G.722 (degrading)',5000,{degraded:true, recovered:true, note:'Rising jitter and loss on the link start affecting call quality.'}),
    sig('A>B','INVITE',{direct:true, label:'re-INVITE (downgrade codec)', sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0) — narrowband, more resilient']}, plain:'User A proposes switching to a simpler, more error-resilient codec to cope with the degraded network.'}),
    sig('B>A','200 OK',{code:200, direct:true, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — PCMU (stabilized)',10000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  onewayprivate:{ name:'One-Way Audio — Private IP in SDP', category:'audioissues', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 10.10.10.15 (private/LAN address)', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, note:'User A is behind a NAT router but its SDP advertises its private LAN address instead of a public one.', plain:'User A tells User B to send audio to an address that only makes sense inside A’s own local network.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — one-way only',12000,{oneway:'B>A', note:'B sends audio correctly to the address A gave it, and A hears B just fine — but A’s outbound audio is addressed to an unreachable private IP, so B never receives it.', plain:'Only one direction of audio works: the caller hears the other person but is not heard back. This is one of the most common real-world SIP/NAT problems.', fix:'This is a classic NAT/SDP mismatch, and the fix lives on User A\u2019s side specifically, since A\u2019s SDP is the one advertising an unreachable address. Enable STUN on A\u2019s device so it learns and advertises its real public address instead of its private one, or — more robustly for a whole site — put a session border controller or ALG-aware proxy in the path that rewrites SDP to the correct public address on the way out. If A is behind a consumer or small-business router, also check for a SIP ALG feature there; those frequently rewrite SDP incorrectly and cause exactly this symptom, and disabling them is often the fastest fix.', rootCause:['User A’s SDP advertises a private LAN address (10.10.10.15)','B sends its audio to that unreachable address','A’s audio to B still works, since B’s address is public','Result: B never receives audio — one-way only']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  onewaynat:{ name:'One-Way Audio — Asymmetric NAT', category:'audioissues', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, plain:'This time, both sides advertise reachable-looking addresses in their SDP — the signaling looks completely normal.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — one-way only',12000,{oneway:'A>B', note:'A’s NAT device has not yet “learned” to accept inbound RTP from B on the port A is using, because A has not sent anything out on that exact port first — so B’s audio to A is silently dropped by A’s own router.', plain:'Even though the SDP addresses are correct, a stateful firewall or NAT device in the path is blocking one direction until it sees outbound traffic first.', fix:'Enable symmetric RTP handling (reply from the same port you receive on) and confirm the media relay or firewall allows the return path — many SBCs solve this automatically by relaying media through a public-facing leg.', rootCause:['SDP addresses look correct on both sides','A’s NAT has no outbound RTP flow yet to “open” a return path','B’s inbound audio to A hits a closed NAT pinhole and is dropped','Result: A hears nothing from B, despite valid signaling']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  blackhole:{ name:'No Audio — RTP Blackhole', category:'audioissues', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — no packets arriving',10000,{noaudio:true, note:'Signaling completed perfectly and both sides agreed on a codec, but the actual RTP/UDP ports needed for media are blocked somewhere in the path — commonly a firewall that only allows SIP (port 5060) through, not the RTP port range.', plain:'The call appears to connect — it even shows as “connected” on both phones — but neither side hears anything at all.', fix:'Open (or correctly forward) the full RTP UDP port range used by your phones or PBX through any firewalls between the endpoints, and confirm no SBC or ALG is rewriting the SDP addresses incorrectly.', rootCause:['SIP signaling (port 5060) completes normally end-to-end','A firewall in the path allows SIP but blocks the RTP UDP port range','Neither side’s RTP packets can reach the other','Result: call shows connected, but total silence both ways']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  packetloss:{ name:'Choppy Audio — Packet Loss & Jitter', category:'audioissues', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — degraded quality',16000,{degraded:true, note:'The network path between the two endpoints is congested, causing packets to arrive late, out of order, or not at all.', plain:'Both sides technically have a two-way audio path, but it sounds choppy, robotic, or cuts in and out because packets are being lost or delayed.', fix:'Check for link congestion or a saturated WAN/Wi-Fi connection, prioritize RTP traffic with QoS (DSCP marking), and treat a larger jitter buffer as a short-term mitigation, not a fix.', rootCause:['Underlying network link is congested or saturated','RTP packets arrive late, out of order, or are dropped','Jitter buffer cannot fully hide the irregular arrival timing','Result: audio sounds choppy or robotic despite a valid two-way path']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  respcode:{ name:'404 Not Found', category:'reference', endpoints:['A','P','B'], isExplorer:true, steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'A request is sent so the selected response can be seen in context.'}),
    sig('P>B','INVITE',{}),
    sig('B>P','404 Not Found',{code:404, plain:'The server looked up the destination and found nobody registered under that address.'}),
    sig('P>A','404 Not Found',{code:404}),
    sig('A>P','ACK',{})
  ]},

  sdpparam:{ name:'m= (media description)', category:'sdp', endpoints:['A','P','B'], isExplorer:true, isSdpExplorer:true, steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{raw:['m=audio 40000 RTP/AVP 111 0 8']}, plain:'Declares a media stream: type (audio), port, transport profile, and the list of payload types being offered.'}),
    sig('P>B','INVITE',{sdp:{raw:['m=audio 40000 RTP/AVP 111 0 8']}}),
    sig('B>P','200 OK',{code:200, sdp:{raw:['(answer SDP omitted for clarity)']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>P','ACK',{})
  ]},

  trunkreg:{ name:'Carrier Trunk Registration', category:'carrier', endpoints:['P','X'], steps:[
    sig('P>X','REGISTER',{firstRequest:true, extraHeaders:['Contact: <sip:pbx@10.0.0.1:5060>'], plain:'The PBX registers itself with the carrier so the carrier knows where to route inbound calls for this trunk.'}),
    sig('X>P','401 Unauthorized',{code:401, extraHeaders:['WWW-Authenticate: Digest realm="carrier.net", nonce="…"'], note:'The carrier challenges the registration before accepting it.', plain:'The carrier will not accept the trunk registration yet — it wants proof of identity first.'}),
    sig('P>X','REGISTER',{label:'REGISTER (with credentials)', extraHeaders:['Authorization: Digest username="trunk-8675309", realm="carrier.net", response="…"'], plain:'The PBX retries registration, this time including the trunk’s credentials.'}),
    sig('X>P','200 OK',{code:200, extraHeaders:['Expires: 3600'], note:'The carrier now knows this PBX is online and where to send inbound calls.', plain:'Registration succeeds — the trunk is active for both inbound and outbound calls.'})
  ]},

  carriercodec:{ name:'Carrier Codec Restriction', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111 9 0', codecs:['opus/48000/2 (111)','G.722/8000 (9)','PCMU/8000 (0)']}, plain:'User A’s call is offered internally with the PBX’s full codec list, including HD options.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{sdp:{c:'IN IP4 10.0.0.1', m:'audio 61000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, note:'This carrier’s trunk profile only allows G.711 — the PBX narrows the offer to match the trunk contract before sending it onward.', plain:'Even though A could support HD voice, the PBX restricts the offer down to what this specific carrier allows.'}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200, note:'The call ends up narrowband even though User A’s device supports wideband — the trunk’s codec policy is the limiting factor.'}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — PCMU (carrier-restricted)',12000,{note:'Every call over this trunk is capped at G.711 quality, regardless of what the two endpoints could otherwise negotiate.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  extonewayaudio:{ name:'External One-Way Audio (Carrier Relay)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — one-way only',12000,{oneway:'B>A', note:'The carrier’s SBC anchors media and rewrites the SDP connection address, but its leg back toward the PBX is misconfigured — audio flows from A to B but never returns.', plain:'Signaling completed cleanly across the trunk, and one direction of audio works, but the carrier’s media relay never sends audio back toward User A.', fix:'Check the carrier’s SBC media relay / far-end NAT configuration for this trunk, confirm the return RTP path is open, and verify the carrier’s SDP rewrite isn’t pointing at a stale address.', rootCause:['The call connects cleanly end-to-end across the trunk','User A’s audio reaches User B without any problem','The carrier’s media relay fails to forward B’s audio back to A','Result: A hears silence while B hears A normally']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  extnoaudio:{ name:'External No Audio (Carrier-Side Failure)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — no packets arriving',10000,{noaudio:true, note:'Signaling completed across the trunk and both sides agreed on a codec, but the carrier’s media relay never actually establishes — commonly because the RTP port range for this trunk isn’t open on the carrier’s side, or the carrier’s SBC failed to anchor the session.', plain:'The call shows as connected on both phones, but there is total silence — no audio in either direction.', fix:'Open a support case with the carrier and provide the Call-ID and timestamp, confirm your side’s RTP port range is correctly published in the trunk’s SIP profile, and check whether other calls over the same trunk are affected (points to a carrier-wide issue) or just this one (points to a per-call anomaly).', rootCause:['Signaling (INVITE through 200 OK) completes normally across the trunk','A codec is successfully negotiated in the SDP','The carrier’s media relay never actually forwards any RTP packets','Result: the call is “connected” but completely silent both ways']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  garbledaudio:{ name:'Garbled Audio (Tandem Transcoding)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 9', codecs:['G.722/8000 (9) — wideband']}, plain:'User A’s phone offers wideband G.722 audio.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{sdp:{c:'IN IP4 10.0.0.1', m:'audio 61000 RTP/AVP 18', codecs:['G.729/8000 (18)']}, note:'This carrier’s trunk profile prefers compressed G.729 to save bandwidth, so the PBX transcodes A’s wideband audio down to G.729 before sending it out.', plain:'The first transcoding pass happens here: G.722 is converted down to G.729.'}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 18', codecs:['G.729/8000 (18) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200, note:'The far end’s own PBX will very likely transcode this G.729 audio again to reach B’s actual handset — a second, cascaded transcoding pass that this simulation cannot see directly.'}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — tandem-transcoded audio',14000,{transcodeArtifact:true, note:'Notice that jitter, loss, and RTT below all look perfectly healthy — that’s the diagnostic signature of a transcoding problem rather than a network problem. Each codec conversion pass discards some audio information; cascaded through two or more passes, speech comes out muffled or slightly robotic even with a flawless network.', plain:'The call sounds muffled or garbled, but stays smooth and continuous — nothing is cutting in and out. That combination is the tell: this is a codec/transcoding issue, not packet loss.', fix:'Where possible, negotiate a shared codec end-to-end so transcoding only happens once (or not at all), avoid low-bitrate codecs like G.729 for calls where quality matters, and ask the carrier whether codec pass-through is available on this trunk.', rootCause:['User A’s wideband G.722 audio is transcoded down to G.729 at the PBX, to match the trunk profile','The far end likely transcodes G.729 again to reach User B’s handset','Each transcoding pass discards audio information that can’t be recovered','Result: garbled, muffled-sounding audio with no packet loss at all']}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  echoscenario:{ name:'Echo (PSTN Gateway Hybrid Coupling)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{}),
    sig('X>B','INVITE',{note:'User B is a traditional PSTN phone reached through the carrier’s TDM-to-IP gateway.'}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — clean, but echo reported',13000,{note:'This is deliberately different from every other audio issue in this tool: echo is an acoustic/analog phenomenon, not a packet-level one. It happens at the carrier’s TDM-to-IP gateway, where a 2-wire to 4-wire “hybrid” conversion imperfectly isolates the send and receive paths, leaking a delayed copy of the far end’s own voice back to them.', plain:'User A hears their own voice echoed back a fraction of a second later. RTP/RTCP statistics for this call will look completely normal — there is nothing to see in a packet capture, because the leak happens in the analog/TDM domain, not the IP network.', fix:'This is diagnosed and fixed at the gateway, not in SIP: check the PSTN gateway’s or carrier’s echo canceller (G.168) is enabled and correctly trained, review Echo Return Loss (ERL) on the affected trunk, and if it’s consistent on one route, escalate to the carrier with call timestamps — it usually points to a specific gateway or trunk group.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  hdvoice:{ name:'HD Voice (Wideband Across Trunk)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111) — wideband']}, plain:'User A’s phone offers Opus, a modern wideband codec.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{note:'Unlike a restrictive trunk, this carrier’s profile allows wideband codecs straight through, unmodified.'}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111) — accepted']}, plain:'User B’s device also supports Opus, so the call negotiates full HD voice end-to-end across the trunk.'}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — Opus wideband (HD)',14000,{note:'No transcoding, no restriction — full-bandwidth audio flows all the way from A to B, giving noticeably clearer, more natural-sounding speech than a narrowband G.711 call.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  anchoredmedia:{ name:'Anchored Media (Carrier Relays RTP)', category:'carrier', endpoints:['A','P','X','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{}),
    sig('X>B','INVITE',{}),
    sig('B>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>X','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('X>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','P'],['P','X'],['X','B']],'RTP — anchored through PBX and carrier',13000,{mixAt:'X', note:'Unlike most calls in this tool, media here does not flow directly between A and B — every packet is relayed through the PBX and the carrier’s SBC. This costs a little extra latency and server capacity, but enables call recording, transcoding, and hides each side’s real IP address from the other.', plain:'Both the PBX and the carrier stay in the audio path for the whole call, rather than stepping aside once signaling is done.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  callforking:{ name:'Parallel Call Forking', category:'multiparty', endpoints:['A','P','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A calls a hunt-group number that rings every member at once.'}),
    sig('P>P','Fork Lookup',{code:'', method:'Fork Lookup', label:'⚙ Hunt group lookup', note:'The proxy looks up the hunt group and forks the INVITE to every registered member simultaneously.', plain:'Instead of trying one phone at a time, the server rings all of them in parallel.'}),
    sig('P>B','INVITE',{}),
    sig('P>C','INVITE',{callId:'fork-c@192.168.1.100', firstRequest:true}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('C>P','180 Ringing',{code:180, callId:'fork-c@192.168.1.100'}),
    sig('B>P','200 OK',{code:200, plain:'User B answers first — this fork wins the race.'}),
    sig('P>A','200 OK',{code:200}),
    sig('P>C','CANCEL',{callId:'fork-c@192.168.1.100', note:'Now that B has answered, the proxy cancels the still-ringing fork to C — a call can only be answered once.'}),
    sig('C>P','200 OK',{code:200, callId:'fork-c@192.168.1.100', cseqOverride:{num:1,method:'CANCEL'}, note:'Response to the CANCEL.'}),
    sig('C>P','487 Request Terminated',{code:487, recovered:true, callId:'fork-c@192.168.1.100', cseqOverride:{num:1,method:'INVITE'}, plain:'C’s leg is formally closed out since it lost the race.'}),
    sig('P>C','ACK',{callId:'fork-c@192.168.1.100'}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',10000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  extdidtransfer:{ name:'Blind Transfer to External DID', category:'transfer', endpoints:['A','P','X','B','C'], steps:[
    sig('A>P','INVITE',{firstRequest:true}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',6000,{}),
    sig('A>B','REFER',{direct:true, extraHeaders:['Refer-To: <sip:+13035551234@carrier.net>'], plain:'User A asks User B to call an outside phone number — a PSTN destination reached through the carrier, not another extension on this system.'}),
    sig('B>A','202 Accepted',{code:202, direct:true}),
    sig('B>P','INVITE',{firstRequest:true, note:'Since the transfer target is external, this new call must route out through the PBX and the carrier trunk, just like any other outbound call.'}),
    sig('P>X','INVITE',{}),
    sig('X>C','INVITE',{}),
    sig('C>X','180 Ringing',{code:180}),
    sig('X>P','180 Ringing',{code:180}),
    sig('P>B','180 Ringing',{code:180}),
    sig('C>X','200 OK',{code:200}),
    sig('X>P','200 OK',{code:200}),
    sig('P>B','200 OK',{code:200}),
    sig('B>P','ACK',{}),
    sig('B>A','NOTIFY',{direct:true, extraHeaders:['Event: refer','Content-Type: message/sipfrag'], body:'SIP/2.0 200 OK', plain:'User B reports back that the external number answered.'}),
    sig('A>B','200 OK',{code:200, direct:true}),
    media([['B','C']],'RTP — B ⇄ external DID',9000,{}),
    sig('A>B','BYE',{direct:true, teardown:true, plain:'User A leaves the call — the transfer is complete.'}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  toomanyhops:{ name:'483 Too Many Hops (Routing Loop)', category:'errors', endpoints:['A','P','P2'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['Max-Forwards: 5 (lowered here to illustrate the loop quickly — normally 70)'], plain:'User A calls User B. To make the loop visible in a handful of hops instead of dozens, this example starts with Max-Forwards: 5 instead of the usual 70.'}),
    sig('P>P2','INVITE',{extraHeaders:['Max-Forwards: 4'], note:'Proxy 1 forwards toward what it believes is the next hop.'}),
    sig('P2>P','INVITE',{extraHeaders:['Max-Forwards: 3'], note:'Proxy 2’s routing table incorrectly points back to Proxy 1 for this same destination — the loop has begun.'}),
    sig('P>P2','INVITE',{extraHeaders:['Max-Forwards: 2']}),
    sig('P2>P','INVITE',{extraHeaders:['Max-Forwards: 1']}),
    sig('P>P2','INVITE',{extraHeaders:['Max-Forwards: 0'], note:'Max-Forwards has now reached zero.'}),
    sig('P2>P','483 Too Many Hops',{code:483, note:'Per RFC 3261, a proxy that would decrement Max-Forwards below zero must reject the request instead of forwarding it again.', plain:'Rather than forward the request once more and risk looping forever, this proxy gives up and reports the failure back the way it came.', fix:'Check both proxies’ routing / dial-plan tables for this destination — one of them has a rule that sends the call right back where it came from. In a real packet capture, trace the Via header chain to see exactly which hop repeats.', rootCause:['Proxy 2’s routing table sends this destination to Proxy 1','Proxy 1’s routing table sends the same destination to Proxy 2','Each hop decrements Max-Forwards, which is the only thing stopping an infinite loop','Once Max-Forwards would go below zero, the proxy must reject rather than loop forever']}),
    sig('P>A','483 Too Many Hops',{code:483, note:'Relayed back to the original caller.'}),
    sig('A>P','ACK',{})
  ]},

  presencepublish:{ name:'Publish Presence Status', category:'presence', endpoints:['A','PS'], steps:[
    sig('A>PS','PUBLISH',{firstRequest:true, extraHeaders:['Event: presence','Expires: 3600','Content-Type: application/pidf+xml'], body:'<presence><tuple><status><basic>open</basic></status></tuple></presence>', contentType:'application/pidf+xml', plain:'User A tells the presence server it is now available — this is what updates a “status” indicator on everyone else’s contact list.'}),
    sig('PS>A','200 OK',{code:200, extraHeaders:['SIP-ETag: abc123'], note:'The server accepts the published state and hands back an ETag to identify this specific publication.', plain:'The server confirms the status was accepted and stored.'}),
    wait('A', 'A few minutes pass', 3000, {}),
    sig('A>PS','PUBLISH',{extraHeaders:['Event: presence','SIP-If-Match: abc123','Expires: 3600'], body:'<presence><tuple><status><basic>closed</basic></status><note>In a meeting</note></status></tuple></presence>', contentType:'application/pidf+xml', note:'The SIP-If-Match header refers back to the earlier ETag — this PUBLISH updates the existing state rather than creating a new one.', plain:'User A changes their status to “In a meeting” — the previous published state is replaced, not duplicated.'}),
    sig('PS>A','200 OK',{code:200, extraHeaders:['SIP-ETag: def456'], plain:'The server confirms the updated status and issues a new ETag for the next update.'})
  ]},

  presencesubscribe:{ name:'Subscribe & Notify', category:'presence', endpoints:['A','PS','B'], steps:[
    sig('A>PS','SUBSCRIBE',{firstRequest:true, extraHeaders:['Event: presence','Expires: 3600'], plain:'User A asks the presence server to notify them whenever User B\u2019s status changes.'}),
    sig('PS>A','200 OK',{code:200, extraHeaders:['Expires: 3600'], note:'A 200 OK here only confirms the subscription was accepted — it does not itself carry B\u2019s status.', plain:'The subscription request is accepted.'}),
    sig('PS>A','NOTIFY',{extraHeaders:['Event: presence','Subscription-State: active;expires=3600','Content-Type: application/pidf+xml'], body:'<presence><tuple><status><basic>open</basic></status></tuple></presence>', contentType:'application/pidf+xml', note:'RFC 6665 requires an immediate NOTIFY right after a successful subscription, carrying the current state — the subscriber should never have to wait for the first update.', plain:'The server immediately pushes User B\u2019s current status, so User A doesn\u2019t have to wait for it to change first.'}),
    sig('A>PS','200 OK',{code:200, plain:'User A\u2019s side confirms it received the NOTIFY.'}),
    wait('PS', 'User B\u2019s status changes elsewhere', 3500, {}),
    sig('PS>A','NOTIFY',{extraHeaders:['Event: presence','Subscription-State: active;expires=3187','Content-Type: application/pidf+xml'], body:'<presence><tuple><status><basic>closed</basic></status></tuple></presence>', contentType:'application/pidf+xml', plain:'The moment User B\u2019s status changes, the server pushes a fresh NOTIFY — the subscriber never has to poll for updates.'}),
    sig('A>PS','200 OK',{code:200})
  ]},

  blf:{ name:'Busy Lamp Field (BLF)', category:'presence', endpoints:['A','PS','B'], steps:[
    sig('A>PS','SUBSCRIBE',{firstRequest:true, extraHeaders:['Event: dialog','Expires: 3600'], plain:'User A\u2019s phone subscribes to watch User B\u2019s line state — this is exactly what powers a BLF (Busy Lamp Field) key on a receptionist console or attendant phone.'}),
    sig('PS>A','200 OK',{code:200, extraHeaders:['Expires: 3600']}),
    sig('PS>A','NOTIFY',{extraHeaders:['Event: dialog','Subscription-State: active','Content-Type: application/dialog-info+xml'], body:'<dialog-info state="full"><dialog id="1"><state>terminated</state></dialog></dialog-info>', contentType:'application/dialog-info+xml', plain:'User B\u2019s line is currently idle — on a real phone, this is the moment the BLF key lights up green.'}),
    sig('A>PS','200 OK',{code:200}),
    wait('PS', 'User B receives an incoming call', 3000, {}),
    sig('PS>A','NOTIFY',{extraHeaders:['Event: dialog','Subscription-State: active','Content-Type: application/dialog-info+xml'], body:'<dialog-info state="partial"><dialog id="2"><state>confirmed</state></dialog></dialog-info>', contentType:'application/dialog-info+xml', note:'dialog state “confirmed” means the call is now answered and active.', plain:'User B just answered a call — the BLF key turns red, so User A knows not to interrupt.'}),
    sig('A>PS','200 OK',{code:200}),
    wait('PS', 'User B ends the call', 3000, {}),
    sig('PS>A','NOTIFY',{extraHeaders:['Event: dialog','Subscription-State: active','Content-Type: application/dialog-info+xml'], body:'<dialog-info state="partial"><dialog id="2"><state>terminated</state></dialog></dialog-info>', contentType:'application/dialog-info+xml', plain:'User B hung up — the BLF key returns to green.'}),
    sig('A>PS','200 OK',{code:200})
  ]},

  sessiontimerrefresh:{ name:'Session Timer Refresh (RFC 4028)', category:'timers', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['Session-Expires: 1800;refresher=uac','Min-SE: 90','Supported: timer'], sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, plain:'User A offers to keep this call alive with a session timer, refreshed every 1800 seconds, and states it will be the one responsible for refreshing.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, extraHeaders:['Session-Expires: 1800;refresher=uac','Require: timer'], sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}, note:'User B agrees to the same 1800-second session interval and confirms User A (the UAC) will be the refresher.'}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — PCMU',7000,{}),
    wait('A', 'Roughly half the session interval elapses (900s, compressed here for demonstration)', 4000, {}),
    sig('A>B','UPDATE',{direct:true, extraHeaders:['Session-Expires: 1800;refresher=uac'], note:'RFC 4028 recommends refreshing at or before half the negotiated interval, so a single lost refresh never has time to expire the session.', plain:'Right on schedule, User A — the agreed refresher — sends a session refresh so the call never times out.'}),
    sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 1800;refresher=uac'], plain:'User B confirms the session timer has been reset for another 1800 seconds.'}),
    media([['A','B']],'RTP — PCMU',5000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  sessiontimerexpiry:{ name:'Session Timer Expiry (No Refresh)', category:'timers', endpoints:['A','B'], steps:[
    sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Session-Expires: 90;refresher=uac','Min-SE: 90','Supported: timer'], sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 0', codecs:['PCMU/8000 (0)']}, plain:'This time the negotiated session interval is deliberately short — 90 seconds — to show what happens if nobody refreshes in time.'}),
    sig('B>A','180 Ringing',{code:180, direct:true}),
    sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 90;refresher=uac'], sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 0', codecs:['PCMU/8000 (0) — accepted']}}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — PCMU',6000,{}),
    wait('A', 'User A\u2019s device crashes or loses network — no refresh is ever sent', 5000, {note:'Neither a re-INVITE nor an UPDATE arrives before the Session-Expires interval runs out.'}),
    sig('B>A','BYE',{direct:true, teardown:true, flagIssue:'soft', note:'Per RFC 4028, once Session-Expires elapses with no refresh, the side that was to receive the refresh must terminate the session itself, exactly as if the far end had hung up.', plain:'User B\u2019s side notices the session timer expired with no refresh, and ends the call — this is the session timer\u2019s real job: cleaning up calls where one side silently vanished.', fix:'A session that repeatedly expires like this points at the refresher failing to send its UPDATE/re-INVITE in time — check that endpoint\u2019s session-timer support and clock, check for a crash or network drop coinciding with the expiry, and consider negotiating a larger Session-Expires (subject to Min-SE) if refreshes are marginal on a congested link.', rootCause:['A 90-second session timer was negotiated, with User A as refresher','User A never sent the required refresh (UPDATE or re-INVITE) before the timer elapsed','Per RFC 4028, the non-refreshing side must terminate the session once the interval expires','Result: the call is torn down even though nobody explicitly hung up']}),
    sig('A>B','200 OK',{code:200, direct:true, teardown:true, note:'Whichever side is still reachable acknowledges the BYE — if User A truly crashed, this response may never arrive at all, and the transaction simply times out.'})
  ]},

  timersref:{ name:'Timer T1 — RTT Estimate', category:'timers', endpoints:['A','B'], isExplorer:true, isTimerExplorer:true, steps:[
    sig('A>B','INVITE',{firstRequest:true, direct:true})
  ]},

  stunbinding:{ name:'STUN Binding Discovery', category:'nat', endpoints:['A','STUN'], steps:[
    sig('A>STUN','Binding Request',{firstRequest:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Transaction ID: 8f3a91c2b7e04d15\n  Attributes: (none required)', plain:'Before it can tell anyone else its address, User A asks a STUN server: “what address does the outside world see me as?” — this is the first step in NAT traversal.'}),
    sig('STUN>A','Binding Success Response',{rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Success Response (0x0101)\n  Transaction ID: 8f3a91c2b7e04d15\nAttributes\n  XOR-MAPPED-ADDRESS: 203.0.113.55:41000', extraHeaders:['XOR-MAPPED-ADDRESS: 203.0.113.55:41000'], note:'The STUN server simply reports back whatever source IP and port it actually received the packet from — that\u2019s User A\u2019s real, public-facing address as seen from outside its own NAT.', plain:'User A now knows its public IP and port — a “server-reflexive” candidate — and can offer this address in SDP instead of its private, unreachable one.'})
  ]},

  icecandidates:{ name:'ICE Candidate Exchange', category:'nat', endpoints:['A','P','B'], steps:[
    sig('A>P','INVITE',{firstRequest:true, extraHeaders:['Supported: ice'], sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111)'], raw:undefined}, note:'The SDP offer carries multiple ICE candidates for the same media line: a host candidate (A\u2019s real private IP), and a server-reflexive candidate (A\u2019s public IP, learned via STUN) — ranked by priority.', plain:'Rather than guessing which address will actually work, User A offers every address it might be reachable at, and lets connectivity checks decide which one really works.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{}),
    sig('B>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('B>P','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111) — accepted']}, note:'User B\u2019s answer carries its own candidate list the same way — a host candidate and a server-reflexive one.', plain:'Both sides now have a full list of each other\u2019s possible addresses, in priority order.'}),
    sig('P>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true})
  ]},

  iceconnectivity:{ name:'ICE Connectivity Checks & Nomination', category:'nat', endpoints:['A','B'], steps:[
    sig('A>B','Connectivity Check (STUN Binding Request)',{firstRequest:true, direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Attributes: PRIORITY, ICE-CONTROLLING, USERNAME (fragment pair)', plain:'With candidates exchanged, both sides now test every candidate pair by sending STUN checks directly between them — highest-priority pair first.'}),
    sig('B>A','Connectivity Check Response',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Success Response (0x0101)\n  Attributes: XOR-MAPPED-ADDRESS', note:'A successful response on this pair means: this specific path actually works, end to end, right now — not just in theory.'}),
    sig('B>A','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Attributes: PRIORITY, ICE-CONTROLLED, USERNAME (fragment pair)', plain:'ICE checks run in both directions — each side verifies the path independently.'}),
    sig('A>B','Connectivity Check Response',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Success Response (0x0101)\n  Attributes: XOR-MAPPED-ADDRESS'}),
    sig('A>B','Nomination (USE-CANDIDATE)',{direct:true, note:'The controlling side marks this working pair as the one to actually use for media — this is “nomination.”', plain:'User A\u2019s side nominates this candidate pair as the winner — media will flow over exactly this path.'}),
    sig('B>A','200 OK',{code:200, direct:true, plain:'User B confirms the nomination.'}),
    media([['A','B']],'RTP — Opus (over nominated ICE pair)',8000,{note:'Media flows over the specific candidate pair that passed connectivity checks — not necessarily the first one offered, and not necessarily a direct path if only a relayed candidate worked.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  registerfail:{ name:'Registration Failure — Wrong Credentials', category:'methods', endpoints:['A','P'], steps:[
    sig('A>P','REGISTER',{firstRequest:true, extraHeaders:['Contact: <sip:userA@192.168.1.100:5060>'], plain:'A phone tells the registrar where it can currently be reached.'}),
    sig('P>A','401 Unauthorized',{code:401, extraHeaders:['WWW-Authenticate: Digest realm="domain.com", nonce="…"'], note:'The registrar challenges the request for credentials before accepting it.', plain:'The server will not accept the registration yet — it wants proof of identity first.'}),
    sig('A>P','REGISTER',{label:'REGISTER (with credentials)', extraHeaders:['Authorization: Digest username="userA", realm="domain.com", response="…" (incorrect password)'], plain:'The phone retries, but the password configured on it doesn\u2019t actually match what the registrar has on file.'}),
    sig('P>A','403 Forbidden',{code:403, note:'The digest response the phone computed doesn\u2019t match what the registrar computes from its own stored credentials — the password is simply wrong.', plain:'Registration is rejected outright: the username exists, but the password doesn\u2019t check out.', fix:'This is almost always a plain credential mismatch: double-check the password configured on the device against what\u2019s actually set for this user on the registrar/PBX, watch for stray whitespace or a recently-rotated password that wasn\u2019t updated on the device, and confirm the username/realm being used matches exactly — some systems are case-sensitive. If this worked before and suddenly stopped, check for a recent bulk password reset or provisioning change.', rootCause:['User A\u2019s phone sent REGISTER with an incorrect password','The registrar computed a different digest response from its own stored credentials','The two responses don\u2019t match, so the registrar cannot verify identity','403 Forbidden is returned and no registration is created']})
  ]},

  registerexpiry:{ name:'Registration Expiry — Missed Refresh', category:'methods', endpoints:['A','P','B'], steps:[
    sig('A>P','REGISTER',{firstRequest:true, extraHeaders:['Contact: <sip:userA@192.168.1.100:5060>','Expires: 3600'], plain:'User A\u2019s phone registers successfully, valid for one hour.'}),
    sig('P>A','200 OK',{code:200, extraHeaders:['Expires: 3600']}),
    wait('A', 'Well over an hour passes, and User A\u2019s phone never sends a refresh REGISTER', 3500, {note:'A healthy phone re-registers well before Expires runs out — specifically so this situation never happens.'}),
    wait('P', 'The registration silently expires on the server', 1800, {note:'The registrar removes the now-stale binding from its location database — as far as it\u2019s concerned, User A no longer has a reachable device.'}),
    sig('B>P','INVITE',{firstRequest:true, plain:'User B tries to call User A, with no idea the registration has lapsed.'}),
    sig('P>B','480 Temporarily Unavailable',{code:480, note:'The registrar checks its location database for User A and finds nothing current — there is no device to route this call to.', plain:'The call fails immediately: from the server\u2019s point of view, User A simply isn\u2019t registered anywhere right now.', fix:'If this happens repeatedly for one device, check why its refresh REGISTER isn\u2019t arriving: a NAT or firewall timeout silently closing the signaling path between refreshes is the most common cause, especially over Wi-Fi or cellular. Also confirm the device\u2019s own re-registration timer isn\u2019t set too close to (or longer than) the Expires value the server is granting, and rule out the device simply having lost power or network entirely.', rootCause:['User A registered successfully with a 3600-second Expires','User A\u2019s device never sent a refresh REGISTER before that time ran out','The registrar removed the expired binding from its location database','An inbound call to User A now has no registered destination to reach']}),
    sig('P>B','ACK',{note:'Acknowledges the final non-2xx response.'})
  ]},

  dnsfailover:{ name:'DNS/SRV Failover — Primary Trunk Down', category:'carrier', endpoints:['A','P','X','X2'], steps:[
    sig('A>P','INVITE',{firstRequest:true, plain:'User A places an outbound call that needs to leave via the carrier trunk.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>X','INVITE',{note:'A DNS SRV lookup for this trunk returned multiple records; the proxy tries the highest-priority target first.', plain:'The call is sent to the primary carrier destination.'}),
    wait('P', 'Retransmissions go completely unanswered — the primary carrier endpoint never responds at all', 3000, {note:'After exhausting the INVITE retransmission timers with total silence, the SIP stack treats this destination as unreachable and moves on.'}),
    sig('P>X2','INVITE',{note:'Per RFC 3263, when the highest-priority SRV target proves unreachable, the client automatically falls back to the next record in priority order.', plain:'Rather than fail the call outright, the proxy retries using the next SRV record — a different physical destination for the same logical trunk.'}),
    sig('X2>P','180 Ringing',{code:180}),
    sig('P>A','180 Ringing',{code:180}),
    sig('X2>P','200 OK',{code:200}),
    sig('P>A','200 OK',{code:200}),
    sig('A>P','ACK',{}),
    media([['A','X2']],'RTP — A ⇄ Carrier (secondary)',9000,{}),
    sig('A>P','BYE',{teardown:true}),
    sig('P>A','200 OK',{code:200, teardown:true})
  ]},

  natsymmetric:{ name:'Symmetric NAT — ICE Connectivity Failure', category:'nat', endpoints:['A','B'], steps:[
    sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Supported: ice'], note:'User A is behind a symmetric NAT — a type that assigns a different external port for every new destination it talks to.', plain:'The SDP offer includes A\u2019s host and server-reflexive candidates, gathered the normal way.'}),
    sig('B>A','200 OK',{code:200, direct:true, plain:'User B answers with its own candidate list.'}),
    sig('A>B','ACK',{direct:true}),
    sig('A>B','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Pair: server-reflexive candidate', plain:'ICE begins testing candidate pairs, starting with the server-reflexive address A learned earlier from its STUN server.'}),
    wait('A', 'No response arrives on this pair', 1500, {note:'Because A is behind a symmetric NAT, the external port it used when talking to its STUN server is different from the port its NAT assigns for this new connection to B — so the reflexive address A offered isn\u2019t actually reachable for this particular peer.'}),
    sig('B>A','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Pair: host candidate', plain:'B tries the host candidate pair instead.'}),
    wait('A', 'This also gets no response, for the same underlying reason', 1500, {}),
    sig('A>A','ICE Failed — No Working Candidate Pair',{code:'', method:'ICE Failed — No Working Candidate Pair', label:'⚠ ICE connectivity check failure', flagIssue:'hard', note:'Every candidate pair failed connectivity checks, and with no TURN relay candidate offered as a fallback, ICE has nothing left to try.', plain:'With every direct and reflexive path unreachable, and no relay option available, the call cannot establish media at all.', fix:'Symmetric NAT is exactly the case TURN relay candidates exist to solve — the fix is making sure both endpoints gather and offer a TURN-relayed candidate alongside host/reflexive ones, and that a TURN server is actually configured and reachable. Adding more STUN servers will not help here, since STUN alone cannot work around symmetric NAT\u2019s one-port-per-destination behavior.', rootCause:['User A sits behind a symmetric NAT, which maps a different external port for every destination it talks to','The server-reflexive candidate A gathered via STUN only works for talking to that STUN server, not to B','Every host and reflexive candidate pair fails connectivity checks as a result','No TURN relay candidate was offered as a fallback, so ICE has no working path left to try']}),
    sig('A>B','BYE',{direct:true, teardown:true, note:'With no viable media path, the call cannot proceed and is torn down.'})
  ]},

  naturnrelay:{ name:'ICE Failure — TURN Relay Fallback', category:'nat', endpoints:['A','B'], steps:[
    sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Supported: ice'], plain:'This time, A\u2019s SDP offer includes a third candidate type alongside host and server-reflexive: a TURN relay candidate, gathered in advance as a fallback.'}),
    sig('B>A','200 OK',{code:200, direct:true}),
    sig('A>B','ACK',{direct:true}),
    sig('A>B','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Pair: host candidate', plain:'ICE checks the highest-priority pair first — direct host-to-host.'}),
    wait('A', 'No response — a firewall on one side blocks this direct path', 1300, {}),
    sig('A>B','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Pair: server-reflexive candidate', plain:'Next, the server-reflexive pair is tried.'}),
    wait('A', 'This also fails — likely symmetric NAT, as in the direct-failure scenario', 1300, {}),
    sig('A>B','Connectivity Check (STUN Binding Request)',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Request (0x0001)\n  Pair: TURN relay candidate', note:'This is the fallback candidate — instead of a direct or reflexive path, both sides route media through a TURN server, sidestepping the NAT problem entirely.', plain:'With direct paths exhausted, ICE tries the relay candidate.'}),
    sig('B>A','Connectivity Check Response',{direct:true, rawPacket:true, rawPacketText:'STUN Message\n  Type: Binding Success Response (0x0101)', plain:'This pair works — relaying through a public TURN server doesn\u2019t require either side to solve the other\u2019s NAT.'}),
    sig('A>B','Nomination (USE-CANDIDATE)',{direct:true, note:'The relay pair is nominated as the winner, since it\u2019s the only one that actually passed connectivity checks.'}),
    sig('B>A','200 OK',{code:200, direct:true}),
    media([['A','B']],'RTP — via TURN relay',8000,{note:'All media now flows through the TURN server rather than peer-to-peer — this reliably works around NAT, at the cost of extra latency and relay bandwidth on the TURN server.'}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]},

  callpark:{ name:'Call Park & Pickup', category:'multiparty', endpoints:['A','P','B','C'], steps:[
    sig('B>P','INVITE',{firstRequest:true, plain:'User B calls User A — a normal call gets established first.'}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>A','INVITE',{}),
    sig('A>P','180 Ringing',{code:180}),
    sig('P>B','180 Ringing',{code:180}),
    sig('A>P','200 OK',{code:200}),
    sig('P>B','200 OK',{code:200}),
    sig('B>A','ACK',{direct:true}),
    media([['A','B']],'RTP — A ⇄ B',4000,{}),
    sig('A>P','REFER',{extraHeaders:['Refer-To: <sip:*701@domain.com>'], plain:'User A wants to park this call so anyone can pick it up from another phone — they REFER the call to a park orbit extension instead of to a person.'}),
    sig('P>A','202 Accepted',{code:202}),
    sig('P>P','Park Orbit Assign',{code:'', method:'Park Orbit Assign', label:'⚙ Parking service', note:'The PBX places the call in a park slot (*701) and starts playing music-on-hold to User B.', plain:'The call now sits waiting in a park slot — a shared holding area anyone on the system can retrieve it from.'}),
    sig('P>A','NOTIFY',{extraHeaders:['Event: refer','Subscription-State: terminated'], note:'Reports back the outcome of the earlier REFER — the parked call was accepted.'}),
    sig('A>P','200 OK',{code:200}),
    media([['P','B']],'MoH — waiting in park',4500,{note:'User B hears music on hold while parked. User A, meanwhile, is now completely free — they can hang up, walk to another phone, or take another call.'}),
    wait('C', 'User C, elsewhere in the building, dials the park orbit extension to retrieve the call', 2500, {}),
    sig('C>P','INVITE',{callId:'pickup@192.168.1.210', firstRequest:true, extraHeaders:['To: <sip:*701@domain.com>'], plain:'User C dials *701 — the same park slot — to pick up the waiting call.'}),
    sig('P>C','200 OK',{code:200, callId:'pickup@192.168.1.210', note:'The PBX bridges User C directly into the parked call.'}),
    sig('C>P','ACK',{callId:'pickup@192.168.1.210'}),
    media([['B','C']],'RTP — B ⇄ C',7000,{}),
    sig('B>C','BYE',{direct:true, teardown:true}),
    sig('C>B','200 OK',{code:200, direct:true, teardown:true})
  ]},

  custom:{ name:'Custom Simulation', category:'custom', isCustom:true, endpoints:['A','CP1','B'], steps:[
    sig('A>CP1','INVITE',{firstRequest:true, sdp:{c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP 111', codecs:['opus/48000/2 (111)']}}),
    sig('CP1>CP1','100 Trying',{code:100}),
    sig('CP1>B','INVITE',{}),
    sig('B>CP1','180 Ringing',{code:180}),
    sig('CP1>A','180 Ringing',{code:180}),
    sig('B>CP1','200 OK',{code:200, sdp:{c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP 111', codecs:['opus/48000/2 (111) — accepted']}}),
    sig('CP1>A','200 OK',{code:200}),
    sig('A>B','ACK',{direct:true}),
    media([['A','B']],'RTP — Opus 48kHz',12000,{}),
    sig('A>B','BYE',{direct:true, teardown:true}),
    sig('B>A','200 OK',{code:200, direct:true, teardown:true})
  ]}
};

/* =========================================================
   SDP PROPAGATION — a plain proxy relays the full message
   including its body. Any P>B / B>P / P>X / X>B relay leg
   that is the immediate continuation of an SDP-bearing
   request/response inherits that same SDP, unless a step
   explicitly authors its own (e.g. a transcoding gateway).
========================================================= */
function propagateRelayedSdp(steps){
  steps.forEach((step,i)=>{
    if(step.kind!=='signal' || step.sdp) return;
    const from = step.dir.split('>')[0];
    if(from!=='P' && from!=='X') return;
    for(let j=i-1;j>=0;j--){
      const prev = steps[j];
      if(prev.kind!=='signal') continue;
      if(prev.method===step.method && prev.code===step.code){
        if(prev.sdp) step.sdp = prev.sdp;
        break;
      }
    }
  });
  return steps;
}
Object.keys(SCENARIO_TEMPLATES).forEach(k=>propagateRelayedSdp(SCENARIO_TEMPLATES[k].steps));

/* =========================================================
   INTERNAL / EXTERNAL CALL TYPE
   External mode inserts a Carrier / SIP Trunk hop between the
   PBX and User B for every step that already routes P<->B,
   modelling a call that leaves the local system onto a trunk.
   Internal mode returns the template unchanged.
========================================================= */
let callType = 'internal';
function endpointSwapAB(id){ return id==='A' ? 'B' : (id==='B' ? 'A' : id); }
function applyCallDirection(templateSteps, templateEndpoints, direction){
  if(direction!=='inbound') return { steps: templateSteps, endpoints: templateEndpoints };
  const steps = templateSteps.map(step=>{
    if(step.kind==='signal'){
      const [from,to] = step.dir.split('>');
      return Object.assign({}, step, {dir: endpointSwapAB(from)+'>'+endpointSwapAB(to)});
    }
    if(step.kind==='media'){
      return Object.assign({}, step, {pairs: step.pairs.map(p=>[endpointSwapAB(p[0]), endpointSwapAB(p[1])])});
    }
    if(step.kind==='wait'){
      return Object.assign({}, step, {at: endpointSwapAB(step.at)});
    }
    return step;
  });
  const endpoints = templateEndpoints.map(endpointSwapAB);
  return { steps, endpoints };
}
function scenarioSupportsDirection(key){
  const tpl = SCENARIO_TEMPLATES[key];
  if(tpl.isCustom) return false;
  let hasA=false, hasB=false;
  tpl.steps.forEach(s=>{
    if(s.kind==='signal'){ s.dir.split('>').forEach(e=>{ if(e==='A') hasA=true; if(e==='B') hasB=true; }); }
    else if(s.kind==='media'){ s.pairs.forEach(p=>{ if(p[0]==='A'||p[1]==='A') hasA=true; if(p[0]==='B'||p[1]==='B') hasB=true; }); }
    else if(s.kind==='wait'){ if(s.at==='A') hasA=true; if(s.at==='B') hasB=true; }
  });
  return hasA && hasB;
}
function applyCallType(templateSteps, templateEndpoints, mode, direction){
  const hasPBHop = templateSteps.some(s=>s.kind==='signal' && (s.dir==='P>B'||s.dir==='B>P'));
  if(mode!=='external' || !hasPBHop){
    return { steps: templateSteps, endpoints: templateEndpoints };
  }
  const insertBeforeP = direction==='inbound';
  const newEndpoints = [];
  templateEndpoints.forEach(e=>{
    if(e==='P' && insertBeforeP) newEndpoints.push('X');
    newEndpoints.push(e);
    if(e==='P' && !insertBeforeP) newEndpoints.push('X');
  });
  const newSteps = [];
  templateSteps.forEach(step=>{
    if(step.kind==='signal'){
      if(step.dir==='P>B'){
        newSteps.push(Object.assign({}, step, {dir:'P>X'}));
        newSteps.push(Object.assign({}, step, {dir:'X>B', note:'Relayed across the external carrier / SIP trunk.', plain:undefined, fix:undefined, rootCause:undefined, extraHeaders:undefined}));
        return;
      }
      if(step.dir==='B>P'){
        newSteps.push(Object.assign({}, step, {dir:'B>X'}));
        newSteps.push(Object.assign({}, step, {dir:'X>P', note:'Relayed across the external carrier / SIP trunk.', plain:undefined, fix:undefined, rootCause:undefined, extraHeaders:undefined}));
        return;
      }
    }
    newSteps.push(step);
  });
  return { steps: propagateRelayedSdp(newSteps), endpoints: newEndpoints };
}

/* =========================================================
   SIGNALING FAULT INJECTION
   Replaces the first successful (2xx) final response to the
   scenario's opening INVITE with a chosen failure, and drops
   everything that depended on the call having succeeded
   (media, BYE, later re-INVITEs) — since the call never
   actually connects. Structural, not cosmetic: this changes
   what happens, not just what a tooltip says.
========================================================= */
const SIGNAL_FAULTS = {
  busy:        { code:486, method:'486 Busy Here',
    fix:'This is normal call-flow behavior, not a system fault — but if it happens more than expected: check whether the destination has multiple lines/appearances available (a single-line device rejects a second call outright), confirm call waiting or a hunt group isn\u2019t misconfigured to reject instead of queue, and check for a DND (Do Not Disturb) state left on accidentally.' },
  notfound:    { code:404, method:'404 Not Found',
    fix:'Confirm the dialed number or extension actually exists and is currently registered — check the PBX/registrar\u2019s registration table. If it used to work, look for a recent extension renumbering, a deleted user, or a dial-plan/routing rule that stopped matching this pattern. For external numbers, confirm the carrier trunk\u2019s number range or DID assignment includes this number.' },
  unavailable: { code:480, method:'480 Temporarily Unavailable',
    fix:'Check whether the destination is registered at all right now (an unregistered endpoint typically produces exactly this response) — look at the registrar\u2019s current registration list. If it is registered, check for an active Do Not Disturb or call-forward-when-unreachable setting, and confirm the device\u2019s network connection/keep-alives are healthy (a device that silently dropped off the network still shows as \u201cregistered\u201d until its registration expires).' },
  timeout:     { code:408, method:'408 Request Timeout',
    fix:'This means no response arrived within the expected transaction timers (see Timer B / Timer F). Check network reachability and firewall/NAT rules between the two sides — a request being sent but never acknowledged is a classic symptom of one-way network connectivity or a blocked return path. Also confirm the destination endpoint isn\u2019t overloaded or hung.' },
  forbidden:   { code:403, method:'403 Forbidden',
    fix:'Check authentication and authorization first: is the trunk\u2019s username/password or IP allow-list correctly configured on both sides? Confirm the calling number/identity is permitted to reach this destination (some carriers reject calls with a missing or mismatched Caller ID), and check for a class-of-service or outbound-dialing restriction blocking this specific route.' },
  notacceptable:{ code:488, method:'488 Not Acceptable Here',
    fix:'This is a codec/media-capability mismatch: the two sides could not agree on anything in the SDP offer. Check each endpoint\u2019s configured codec list and make sure they share at least one codec in common, confirm the media type (audio/video/fax) is supported on both ends, and check whether a transcoding-capable device needs to sit in the path if the endpoints genuinely can\u2019t share a codec.' },
  servererror: { code:500, method:'500 Server Internal Error',
    fix:'This points at the PBX/proxy/server itself, not the far end. Check that server\u2019s logs and health first — recent config changes, a crashed service, high CPU/memory, or a database/registration-store outage are the usual causes. If it\u2019s intermittent, check for resource limits (max concurrent calls/sessions) being hit under load.' },
  serviceunavailable:{ code:503, method:'503 Service Unavailable',
    fix:'The server is reachable but is deliberately refusing new work right now — commonly an overload protection kicking in, a maintenance window, or a licensing/capacity limit being hit. Check the server\u2019s current call/session count against its licensed or configured maximum, and check for a Retry-After value telling you how long to back off.' }
};
function applySignalingFault(templateSteps, mode){
  const fault = SIGNAL_FAULTS[mode];
  if(!fault) return templateSteps;
  let successIdx = -1;
  for(let i=0;i<templateSteps.length;i++){
    const s = templateSteps[i];
    if(s.kind==='signal' && s.code>=200 && s.code<300 && !s.callId){ successIdx = i; break; }
  }
  if(successIdx===-1) return templateSteps;
  let blockEnd = successIdx;
  while(blockEnd+1<templateSteps.length && templateSteps[blockEnd+1].kind==='signal' &&
        templateSteps[blockEnd+1].code===templateSteps[successIdx].code && !templateSteps[blockEnd+1].callId){
    blockEnd++;
  }
  let ackIdx = -1;
  for(let i=blockEnd+1;i<templateSteps.length;i++){
    if(templateSteps[i].kind==='signal' && templateSteps[i].method==='ACK' && !templateSteps[i].callId){ ackIdx = i; break; }
    if(templateSteps[i].kind==='signal' && !templateSteps[i].code && templateSteps[i].method!=='ACK') break;
  }
  const out = templateSteps.slice(0, successIdx).map(s=>Object.assign({}, s));
  for(let i=successIdx;i<=blockEnd;i++){
    const orig = templateSteps[i];
    const isOrigin = i===successIdx;
    out.push(Object.assign({}, orig, {
      code: fault.code, method: fault.method,
      sdp: undefined, extraHeaders: undefined,
      note: isOrigin ? 'Injected signaling fault — this call would normally succeed at this point.' : 'Relayed back.',
      plain: isOrigin ? 'A signaling fault was injected for this playthrough: instead of succeeding, the call fails here, and never reaches the media stage.' : undefined,
      fix: isOrigin ? fault.fix : undefined, rootCause: undefined
    }));
  }
  if(ackIdx>-1) out.push(Object.assign({}, templateSteps[ackIdx]));
  return out;
}

/* =========================================================
   CUSTOM SIMULATION BUILDER
   Builds a fresh, user-defined topology (0–3 PBX hops, an
   optional firewall, an optional carrier) and generates a
   normal successful call across it, then reuses the exact
   same, already-tested applyCallDirection / applySignalingFault
   transforms every other scenario uses. Never touches
   SCENARIO_TEMPLATES for any of the 47 built-in scenarios.
========================================================= */
const CUSTOM_CODECS = {
  opus:{ pt:111, label:'Opus 48kHz', entry:'opus/48000/2 (111)' },
  g722:{ pt:9,   label:'G.722 wideband', entry:'G.722/8000 (9)' },
  pcmu:{ pt:0,   label:'PCMU (G.711 µ-law)', entry:'PCMU/8000 (0)' },
  pcma:{ pt:8,   label:'PCMA (G.711 A-law)', entry:'PCMA/8000 (8)' },
  g729:{ pt:18,  label:'G.729 (compressed)', entry:'G.729/8000 (18)' }
};
const FIREWALL_BEHAVIORS = {
  passthrough:{ label:'Passes traffic through cleanly' },
  oneway:{ label:'Blocks return audio (one-way audio)' },
  noaudio:{ label:'Blocks all RTP (no audio)' },
  degraded:{ label:'Introduces packet loss / jitter' }
};
function buildCustomTopology(params){
  const mid = [];
  for(let i=1;i<=params.numPbx;i++) mid.push('CP'+i);
  if(params.callType==='external') mid.push('X');
  if(params.firewall.enabled){
    let idx;
    if(params.firewall.position==='near-a') idx = 0;
    else if(params.firewall.position==='near-b') idx = mid.length;
    else idx = Math.floor(mid.length/2);
    mid.splice(idx, 0, 'CFW');
  }
  return ['A', ...mid, 'B'];
}
function chainHops(seq){
  const hops = [];
  for(let i=0;i<seq.length-1;i++) hops.push([seq[i], seq[i+1]]);
  return hops;
}
function generateCustomSteps(endpoints, params){
  const steps = [];
  const hops = chainHops(endpoints);
  const codec = CUSTOM_CODECS[params.codec] || CUSTOM_CODECS.opus;
  const offerSdp = {c:'IN IP4 192.168.1.100', m:'audio 40000 RTP/AVP '+codec.pt, codecs:[codec.entry]};
  const answerSdp = {c:'IN IP4 192.168.1.200', m:'audio 50000 RTP/AVP '+codec.pt, codecs:[codec.entry+' — accepted']};

  hops.forEach((hop,i)=>{
    const extra = {};
    if(i===0){ extra.firstRequest = true; extra.sdp = offerSdp; extra.plain = 'User A starts the call across the custom topology you built.'; }
    steps.push(sig(hop[0]+'>'+hop[1], 'INVITE', extra));
    if(i===0 && hops.length>1){
      steps.push(sig(hop[1]+'>'+hop[1], '100 Trying', {code:100}));
    }
  });

  const backHops = hops.slice().reverse().map(h=>[h[1], h[0]]);
  backHops.forEach(hop=> steps.push(sig(hop[0]+'>'+hop[1], '180 Ringing', {code:180})));
  backHops.forEach((hop,i)=> steps.push(sig(hop[0]+'>'+hop[1], '200 OK', {code:200, ...(i===0?{sdp:answerSdp, plain:'User B answers.'}:{})})));

  steps.push(sig('A>B', 'ACK', {direct:true}));

  const mediaExtra = { note: undefined };
  if(params.firewall.enabled && params.firewall.behavior!=='passthrough'){
    if(params.firewall.behavior==='oneway') Object.assign(mediaExtra, {oneway:'B>A', note:'The firewall in this path blocks return audio.', plain:'Only one direction of audio works because of the firewall you configured.', fix:'Open the firewall for the RTP port range in both directions.', rootCause:['A firewall sits in the media path','It allows outbound RTP but blocks the return direction','Result: one-way audio']});
    else if(params.firewall.behavior==='noaudio') Object.assign(mediaExtra, {noaudio:true, note:'The firewall in this path blocks RTP entirely.', plain:'Signaling succeeds, but no audio gets through in either direction because of the firewall you configured.', fix:'Open the firewall for the full RTP UDP port range used by your endpoints.', rootCause:['A firewall sits in the media path','It blocks the RTP/UDP port range entirely','Result: total silence despite a “connected” call']});
    else if(params.firewall.behavior==='degraded') Object.assign(mediaExtra, {degraded:true, note:'The firewall/link in this path introduces packet loss and jitter.', plain:'Audio works both ways but sounds choppy because of the firewall or link you configured.'});
  }
  steps.push(media([['A','B']], 'RTP — '+codec.label, 12000, mediaExtra));

  steps.push(sig('A>B','BYE',{direct:true, teardown:true}));
  steps.push(sig('B>A','200 OK',{code:200, direct:true, teardown:true}));
  return steps;
}
function buildCustomSummaryName(params){
  if(params.name && params.name.trim()) return params.name.trim();
  const parts = [];
  parts.push(params.numPbx===0 ? 'Direct (no PBX)' : (params.numPbx+' PBX hop'+(params.numPbx===1?'':'s')));
  if(params.firewall.enabled) parts.push('Firewall');
  if(params.callType==='external') parts.push('External');
  if(params.direction==='inbound') parts.push('Inbound');
  if(params.transport!=='udp') parts.push(params.transport.toUpperCase());
  const codec = CUSTOM_CODECS[params.codec];
  if(codec) parts.push(codec.label);
  if(params.outcome!=='success'){
    const fault = SIGNAL_FAULTS[params.outcome];
    parts.push('Fails (' + (fault ? fault.method : params.outcome) + ')');
  }
  return 'Custom: ' + parts.join(' · ');
}
function runCustomBuilder(params){
  const endpoints = buildCustomTopology(params);
  let steps = generateCustomSteps(endpoints, params);
  const dirResult = applyCallDirection(steps, endpoints, params.direction);
  steps = applySignalingFault(dirResult.steps, params.outcome);
  SCENARIO_TEMPLATES.custom.endpoints = dirResult.endpoints;
  SCENARIO_TEMPLATES.custom.steps = steps;
  SCENARIO_TEMPLATES.custom.name = buildCustomSummaryName(params);
  SCENARIOS.custom.endpoints = dirResult.endpoints;
  SCENARIOS.custom.steps = steps;
  SCENARIOS.custom.name = SCENARIO_TEMPLATES.custom.name;
  callType = params.callType;
  callDirection = params.direction;
  transportMode = params.transport;
}

const SCENARIOS = {};
Object.keys(SCENARIO_TEMPLATES).forEach(k=>{ SCENARIOS[k] = Object.assign({}, SCENARIO_TEMPLATES[k]); });
let signalFaultMode = 'none';
let callDirection = 'outbound';
let transportMode = 'udp';
function portForEndpoint(id){
  const ep = ENDPOINTS[id];
  const base = (ep && ep.port) ? Number(ep.port) : 5060;
  if(transportMode==='tls' && base===5060) return 5061;
  return base;
}
function sipScheme(){ return transportMode==='tls' ? 'sips' : 'sip'; }
function rebuildScenario(key){
  const tpl = SCENARIO_TEMPLATES[key];
  if(tpl.isExplorer || tpl.isCustom) return;
  const dirResult = applyCallDirection(tpl.steps, tpl.endpoints, callDirection);
  let {steps, endpoints} = applyCallType(dirResult.steps, dirResult.endpoints, callType, callDirection);
  steps = applySignalingFault(steps, signalFaultMode);
  SCENARIOS[key].steps = steps;
  SCENARIOS[key].endpoints = endpoints;
}
function scenarioSupportsCallType(key){
  const tpl = SCENARIO_TEMPLATES[key];
  if(tpl.isCustom) return false;
  return tpl.steps.some(s=>s.kind==='signal' && (s.dir==='P>B'||s.dir==='B>P'));
}

const CATEGORIES = [
  {id:'core', label:'Core Call Flow'},
  {id:'transfer', label:'Call Transfer'},
  {id:'forwarding', label:'Call Forwarding'},
  {id:'multiparty', label:'Multi-Party'},
  {id:'faxdtmf', label:'Fax & DTMF'},
  {id:'sdp', label:'SDP & Codecs'},
  {id:'audioissues', label:'Audio & RTP Issues'},
  {id:'carrier', label:'Carrier & Trunking'},
  {id:'errors', label:'Signaling & Errors'},
  {id:'methods', label:'Other SIP Methods'},
  {id:'reference', label:'Response Code Lookup'},
  {id:'presence', label:'Presence & BLF'},
  {id:'timers', label:'SIP Timers & Retransmission'},
  {id:'nat', label:'NAT & ICE Traversal'},
  {id:'custom', label:'My Custom Simulation'}
];
function scenariosInCategory(catId){ return Object.keys(SCENARIO_TEMPLATES).filter(k=>SCENARIO_TEMPLATES[k].category===catId); }

/* =========================================================
   RESPONSE CODE EXPLORER — covers dozens of SIP status codes
   through one generic generator instead of one scenario each.
========================================================= */
const RESPONSE_REASONS = {
  100:{name:'Trying', desc:'A device along the way confirms it received the request, so the sender stops resending it.'},
  180:{name:'Ringing', desc:'The destination is alerting — the phone is ringing, but nobody has answered yet.'},
  181:{name:'Call Is Being Forwarded', desc:'The request is being redirected to another destination on the callee’s behalf.'},
  182:{name:'Queued', desc:'The callee is currently unavailable, and the call has been placed in a queue.'},
  183:{name:'Session Progress', desc:'Early progress is reported back, sometimes carrying early media like ringback tone, before anyone answers.'},
  200:{name:'OK', desc:'The request succeeded. For an INVITE this carries the SDP answer and establishes the session.'},
  202:{name:'Accepted', desc:'The request has been accepted for processing, but the action it triggers is not necessarily finished yet.'},
  204:{name:'No Notification', desc:'The request succeeded but there is nothing further to report.'},
  300:{name:'Multiple Choices', desc:'Several possible destinations exist, and the client may choose one of them.'},
  301:{name:'Moved Permanently', desc:'The target has moved permanently — future requests should go to the new address.'},
  302:{name:'Moved Temporarily', desc:'The target is temporarily reachable elsewhere; the response supplies the new Contact to try.'},
  305:{name:'Use Proxy', desc:'The request must be retried through the specific proxy indicated in the response.'},
  380:{name:'Alternative Service', desc:'The call could not be completed as dialed, but an alternative service is offered instead.'},
  400:{name:'Bad Request', desc:'The request was malformed or contained invalid syntax that the server could not parse.'},
  401:{name:'Unauthorized', desc:'Authentication is required — the server wants credentials before it will accept this request.'},
  403:{name:'Forbidden', desc:'The server understood the request but refuses to authorize it, regardless of credentials.'},
  404:{name:'Not Found', desc:'The server looked up the destination and found nobody registered under that address.'},
  405:{name:'Method Not Allowed', desc:'The server understands the request but this particular method is not allowed on this resource.'},
  406:{name:'Not Acceptable', desc:'Nothing the server can offer matches what the request said it would accept.'},
  407:{name:'Proxy Authentication Required', desc:'A proxy along the path wants its own credentials before forwarding the request.'},
  408:{name:'Request Timeout', desc:'The server gave up waiting for information it needed to complete the request in time.'},
  410:{name:'Gone', desc:'The requested resource used to exist here but has been permanently removed.'},
  413:{name:'Request Entity Too Large', desc:'The request body was larger than the server is willing to process.'},
  414:{name:'Request-URI Too Long', desc:'The destination address in the request was too long for the server to handle.'},
  415:{name:'Unsupported Media Type', desc:'The body of the request uses a format the recipient does not support.'},
  420:{name:'Bad Extension', desc:'The request requires a SIP extension the server does not support.'},
  421:{name:'Extension Required', desc:'The server needs a specific SIP extension that this request did not include.'},
  423:{name:'Interval Too Brief', desc:'The requested expiration interval is shorter than the server is willing to accept.'},
  480:{name:'Temporarily Unavailable', desc:'The destination is temporarily unreachable — for example, nobody answered in time.'},
  481:{name:'Call/Transaction Does Not Exist', desc:'The receiving endpoint has no record of the dialog or transaction this request refers to.'},
  482:{name:'Loop Detected', desc:'The request has looped back through a path it already traveled.'},
  483:{name:'Too Many Hops', desc:'The request exceeded its hop limit, often pointing to a routing loop.'},
  484:{name:'Address Incomplete', desc:'The destination address is missing digits or information needed to route it.'},
  485:{name:'Ambiguous', desc:'The address matches more than one possible target, and the server cannot pick one on its own.'},
  486:{name:'Busy Here', desc:'The destination is already on another call and cannot take a second one right now.'},
  487:{name:'Request Terminated', desc:'The original request was ended before it completed — commonly because it was cancelled.'},
  488:{name:'Not Acceptable Here', desc:'The destination cannot support anything in the offered media — most often, no shared codec.'},
  489:{name:'Bad Event', desc:'The event package named in the request is not one the recipient supports.'},
  491:{name:'Request Pending', desc:'Another request is already being processed for this same dialog, so this one must wait.'},
  493:{name:'Undecipherable', desc:'The request was encrypted or signed in a way the recipient could not decode.'},
  500:{name:'Server Internal Error', desc:'Something went wrong on the server itself while handling an otherwise valid request.'},
  501:{name:'Not Implemented', desc:'The server does not support the method or feature this request needs.'},
  502:{name:'Bad Gateway', desc:'A gateway or proxy got an invalid response from the next server down the line.'},
  503:{name:'Service Unavailable', desc:'The service is temporarily unable to handle the request — often overload or maintenance.'},
  504:{name:'Server Time-out', desc:'A gateway or proxy did not get a timely response from the next hop it depends on.'},
  505:{name:'Version Not Supported', desc:'The server does not support the SIP protocol version used in the request.'},
  513:{name:'Message Too Large', desc:'The request message itself was too large for the server to process.'},
  600:{name:'Busy Everywhere', desc:'The destination is busy at every location it could be reached, not just one device.'},
  603:{name:'Decline', desc:'The destination is reachable but the person explicitly declines the call.'},
  604:{name:'Does Not Exist Anywhere', desc:'The requested user is not known at any destination the server can reach.'},
  606:{name:'Not Acceptable', desc:'The destination is reachable but finds the overall session terms unacceptable.'}
};
function classOf(code){
  const c = Number(code);
  if(c<200) return '1xx'; if(c<300) return '2xx'; if(c<400) return '3xx';
  if(c<500) return '4xx'; if(c<600) return '5xx'; return '6xx';
}
function generateResponseSteps(code){
  const info = RESPONSE_REASONS[code] || {name:'Response', desc:'A SIP response in this class.'};
  const klass = classOf(code);
  const isProvisional = klass==='1xx';
  const isRedirect = klass==='3xx';
  const steps = [];
  steps.push(sig('A>P','INVITE',{firstRequest:true, plain:'A request is sent so the '+code+' response can be seen in context.'}));
  if(String(code)!=='100'){
    steps.push(sig('P>P','100 Trying',{code:100, note:'Some servers send this hop-by-hop acknowledgement first.'}));
  }
  steps.push(sig('P>B','INVITE',{}));
  steps.push(sig('B>P', info.name, {code:Number(code), label:code+' '+info.name, plain:info.desc}));
  steps.push(sig('P>A', info.name, {code:Number(code), label:code+' '+info.name, note:'Relayed back to User A.'}));
  if(!isProvisional){
    steps.push(sig('A>P','ACK',{note:'Acknowledges the final response.'}));
  }
  if(isRedirect){
    steps.push(sig('A>C','INVITE',{firstRequest:true, plain:'User A can now try the alternate destination the response supplied.'}));
  }
  return steps;
}
function regenerateRespCode(code){
  const info = RESPONSE_REASONS[code] || {name:'Response', desc:'A SIP response in this class.'};
  const isRedirect = classOf(code)==='3xx';
  const baseEndpoints = isRedirect ? ['A','P','B','C'] : ['A','P','B'];
  const baseSteps = propagateRelayedSdp(generateResponseSteps(code));
  const dirResult = applyCallDirection(baseSteps, baseEndpoints, callDirection);
  const {steps, endpoints} = applyCallType(dirResult.steps, dirResult.endpoints, callType, callDirection);
  SCENARIOS.respcode.endpoints = endpoints;
  SCENARIOS.respcode.steps = steps;
  SCENARIOS.respcode.name = code+' '+info.name;
}

/* =========================================================
   SDP PARAMETER EXPLORER — one generic generator across the
   most common SDP-level attributes and fields.
========================================================= */
const SDP_PARAMS = {
  m:{ label:'m= (media description)', line:'m=audio 40000 RTP/AVP 111 0 8', desc:'Declares a media stream: type (audio), port, transport profile, and the list of payload types being offered.' },
  c:{ label:'c= (connection address)', line:'c=IN IP4 192.168.1.100', desc:'States the IP address media should be sent to for this stream.' },
  o:{ label:'o= (origin)', line:'o=- 2890844526 2890842807 IN IP4 192.168.1.100', desc:'Identifies the session’s creator and a version number used to detect when the SDP has changed between offers.' },
  rtpmap:{ label:'a=rtpmap', line:'a=rtpmap:111 opus/48000/2', desc:'Maps a numeric payload type to an actual codec name, clock rate, and channel count.' },
  fmtp:{ label:'a=fmtp', line:'a=fmtp:111 minptime=10;useinbandfec=1', desc:'Passes extra format-specific parameters for a codec — such as Opus’s minimum packet time or forward error correction.' },
  ptime:{ label:'a=ptime', line:'a=ptime:20', desc:'States how many milliseconds of audio are packed into each RTP packet — 20ms is the most common value.' },
  maxptime:{ label:'a=maxptime', line:'a=maxptime:40', desc:'The longest packetization time the endpoint is willing to accept.' },
  sendrecv:{ label:'a=sendrecv', line:'a=sendrecv', desc:'This endpoint will both send and receive media — the normal, active-call state.' },
  sendonly:{ label:'a=sendonly', line:'a=sendonly', desc:'This endpoint will only send media and does not want to receive any — typically seen when a call is placed on hold.' },
  recvonly:{ label:'a=recvonly', line:'a=recvonly', desc:'This endpoint will only receive media and will not send any.' },
  inactive:{ label:'a=inactive', line:'a=inactive', desc:'No media should flow in either direction for this stream right now.' },
  rtcp:{ label:'a=rtcp', line:'a=rtcp:40001', desc:'States the specific port RTCP quality reports should be sent to, when it differs from the RTP port plus one.' },
  rtcpmux:{ label:'a=rtcp-mux', line:'a=rtcp-mux', desc:'RTP and RTCP will share a single port instead of using two separate ones — common in WebRTC to simplify NAT traversal.' },
  iceufrag:{ label:'a=ice-ufrag / a=ice-pwd', line:'a=ice-ufrag:8hhY  a=ice-pwd:asd88fgpdd777uzjYhagZg', desc:'Credentials used by ICE (Interactive Connectivity Establishment) so both sides can authenticate connectivity checks before media starts.' },
  candidate:{ label:'a=candidate', line:'a=candidate:1 1 UDP 2130706431 192.168.1.100 40000 typ host', desc:'One possible network path — IP, port, and priority — that ICE can try in order to connect the media.' },
  fingerprint:{ label:'a=fingerprint', line:'a=fingerprint:sha-256 4A:DE:B2:9C:71:…', desc:'A cryptographic fingerprint of the certificate used to secure the media with DTLS, letting each side verify who they are encrypting with.' },
  setup:{ label:'a=setup', line:'a=setup:actpass', desc:'States this endpoint’s role in the DTLS handshake — whether it will act as the client, the server, or either.' },
  mid:{ label:'a=mid', line:'a=mid:0', desc:'A short identifier tag for this particular media line, used to match it up when several streams are bundled together.' },
  bundle:{ label:'a=group:BUNDLE', line:'a=group:BUNDLE 0 1', desc:'Declares that several media lines — for example audio and video — should share a single underlying transport connection.' },
  extmap:{ label:'a=extmap', line:'a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level', desc:'Registers an RTP header extension — extra metadata carried alongside every packet, such as audio level.' },
  bandwidth:{ label:'b=AS (bandwidth)', line:'b=AS:64', desc:'Suggests a bandwidth limit, in kbit/s, for this media stream.' },
  crypto:{ label:'a=crypto (SRTP)', line:'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:d0RmdmcmVCspeEc3QGZiNWpVLFJhQ1o=', desc:'Carries the actual SRTP key material directly in the SDP, for security negotiated without a separate DTLS handshake.' }
};

/* =========================================================
   SIP TIMER & RETRANSMISSION EXPLORER
========================================================= */
const TIMER_INFO = {
  T1:{ label:'Timer T1 — RTT Estimate', value:'500ms (default)', rfc:'RFC 3261 §17.1.1.1',
    desc:'The base estimate of round-trip time between two SIP endpoints. Every other retransmission timer in this list is defined in terms of T1 — it is the one constant everything else scales from.' },
  T2:{ label:'Timer T2 — Max Retransmit Interval', value:'4 seconds', rfc:'RFC 3261 §17.1.2.2',
    desc:'The ceiling on how long a UAS/proxy will wait between retransmissions of non-INVITE responses and non-INVITE requests. Intervals double from T1 as usual, but once they would exceed T2, they simply stay at T2 instead of continuing to grow.' },
  timerA:{ label:'Timer A — INVITE Retransmit Interval', value:'Starts at T1, doubles each time', rfc:'RFC 3261 §17.1.1.2',
    desc:'Governs retransmission of an INVITE request over an unreliable transport like UDP. It starts at T1 (500ms) and doubles after every retransmit — 500ms, 1s, 2s, 4s, 8s… — until either a response arrives or Timer B gives up entirely.' },
  timerB:{ label:'Timer B — INVITE Transaction Timeout', value:'64×T1 = 32 seconds', rfc:'RFC 3261 §17.1.1.2',
    desc:'The absolute deadline for an INVITE transaction. If no final response has arrived by the time Timer B elapses, the transaction gives up and reports a timeout to the application — this is what actually stops Timer A\u2019s doubling from continuing forever.' },
  timerF:{ label:'Timer F — Non-INVITE Transaction Timeout', value:'64×T1 = 32 seconds', rfc:'RFC 3261 §17.1.2.2',
    desc:'The non-INVITE equivalent of Timer B — the deadline for requests like BYE, REGISTER, or OPTIONS. These retransmit on the T2-capped schedule, and if nothing arrives within 64×T1, the transaction times out.' },
  sessionExpires:{ label:'Session-Expires', value:'Negotiated per call (e.g. 1800s)', rfc:'RFC 4028',
    desc:'The maximum time a session is allowed to go without being refreshed before it\u2019s considered dead. Negotiated in the INVITE and confirmed in the response, along with which side — UAC or UAS — is responsible for sending the refresh.' },
  minSE:{ label:'Min-SE — Minimum Session Interval', value:'Set by the receiving side (e.g. 90s)', rfc:'RFC 4028',
    desc:'The shortest session interval an endpoint is willing to accept. If a caller proposes a Session-Expires below this, the request is rejected with 422 (Session Interval Too Small) and told the acceptable minimum, so it can retry.' },
  refreshInterval:{ label:'Refresh Interval (Recommended Timing)', value:'Half of Session-Expires', rfc:'RFC 4028 §7.3',
    desc:'RFC 4028 recommends the refresher send its UPDATE or re-INVITE at or before half of the negotiated Session-Expires — that way, even if one refresh attempt is lost, there\u2019s still time to retry before the session actually expires.' }
};
function generateTimerSteps(key){
  switch(key){
    case 'T1':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, plain:'User A sends an INVITE over UDP — an unreliable transport, so SIP itself is responsible for detecting and recovering from lost packets.'}),
        wait('A', 'T1 (500ms) elapses with no response', 1800, {note:'T1 is the base round-trip-time estimate — the starting point for every retransmission timer.'}),
        sig('A>B','INVITE',{direct:true, note:'Identical retransmission of the original INVITE — same Call-ID, same CSeq, same branch.', plain:'Since T1 elapsed with nothing back, the exact same INVITE is sent again.'}),
        sig('B>A','200 OK',{code:200, direct:true, plain:'This time a response arrives, so no further retransmissions are needed — Timer A\u2019s doubling never gets a chance to continue.'}),
        sig('A>B','ACK',{direct:true})
      ];
    case 'T2':
      return [
        sig('A>B','BYE',{firstRequest:true, direct:true, teardown:true, plain:'A non-INVITE request — BYE, in this case — follows the same retransmission idea as INVITE, but its interval is capped by Timer T2 instead of growing without bound.'}),
        wait('A', 'T1 (500ms) elapses, no response', 1300, {}),
        sig('A>B','BYE',{direct:true, teardown:true, note:'Retransmit #1 — next interval will double to 1 second.'}),
        wait('A', '1 second elapses, no response', 1300, {}),
        sig('A>B','BYE',{direct:true, teardown:true, note:'Retransmit #2 — next interval doubles again, to 2 seconds.'}),
        wait('A', '2 seconds elapse, no response', 1300, {}),
        sig('A>B','BYE',{direct:true, teardown:true, note:'Retransmit #3 — the next doubling would be 4 seconds, which is exactly T2, so the interval stops growing here.'}),
        wait('A', 'T2 (4 seconds) elapses — the interval is now capped and will not double further', 1600, {}),
        sig('A>B','BYE',{direct:true, teardown:true, note:'Retransmit #4, still spaced 4 seconds apart — every retransmission from here on uses the T2 ceiling, not a doubling interval.'}),
        sig('B>A','200 OK',{code:200, direct:true, teardown:true, plain:'A response finally arrives, ending the retransmissions.'})
      ];
    case 'timerA':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, plain:'Timer A controls exactly this: how often an unanswered INVITE gets retransmitted, and how that interval grows.'}),
        wait('A', 'Timer A = T1 = 500ms elapses', 1500, {}),
        sig('A>B','INVITE',{direct:true, note:'Retransmit #1 at 500ms. Timer A now doubles to 1 second.'}),
        wait('A', 'Timer A = 1 second elapses', 1500, {}),
        sig('A>B','INVITE',{direct:true, note:'Retransmit #2 at 1s. Timer A doubles again, to 2 seconds.'}),
        wait('A', 'Timer A = 2 seconds elapses', 1500, {}),
        sig('A>B','INVITE',{direct:true, note:'Retransmit #3 at 2s. Unlike non-INVITE requests, INVITE retransmissions are not capped by T2 — they keep doubling until Timer B (32s total) gives up.'}),
        sig('B>A','180 Ringing',{code:180, direct:true, plain:'A provisional response arrives — this alone is enough to stop Timer A\u2019s retransmissions, even though the call isn\u2019t answered yet.'}),
        sig('B>A','200 OK',{code:200, direct:true}),
        sig('A>B','ACK',{direct:true})
      ];
    case 'timerB':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, plain:'This time, nothing ever answers — this is what Timer B (the overall INVITE transaction timeout) exists to catch.'}),
        wait('A', 'Timer A = 500ms elapses, no response', 1300, {}),
        sig('A>B','INVITE',{direct:true, note:'Retransmit — Timer A doubles to 1s.'}),
        wait('A', 'Timer A = 1s, 2s, 4s, 8s, 16s all elapse in turn — each with a retransmission and no response (compressed here for demonstration)', 2200, {}),
        sig('A>B','INVITE',{direct:true, note:'Final retransmit — the cumulative time since the original INVITE is now approaching Timer B\u2019s 32-second ceiling.'}),
        wait('A', 'Timer B (64×T1 = 32 seconds total) elapses with no final response at all', 2000, {}),
        sig('A>A','408 Request Timeout',{code:408, note:'This 408 is generated locally by User A\u2019s own SIP stack — it was never actually sent by User B, because User B (or the network in between) never responded at all.', plain:'Timer B has now run out. Rather than retry forever, the transaction layer gives up and reports the failure to the application as a 408 timeout.', fix:'A call that always times out like this, with zero response of any kind, points at a network-level problem rather than a SIP-level rejection: confirm the destination is actually reachable (routing, firewall, NAT), check for a hung or crashed device that accepted the TCP/UDP packet but never processed it, and confirm nothing is silently dropping the INVITE in transit.', rootCause:['An INVITE was sent, and retransmitted repeatedly per Timer A\u2019s doubling schedule','Not one single response — not even a provisional 100 Trying — ever arrived','After 64×T1 (32 seconds) with total silence, Timer B expired','The transaction layer reports this to the application as a local 408, since no real response exists to relay']})
      ];
    case 'timerF':
      return [
        sig('A>B','OPTIONS',{firstRequest:true, direct:true, plain:'Timer F is Timer B\u2019s counterpart for non-INVITE requests — here, an OPTIONS keep-alive ping that never gets answered.'}),
        wait('A', 'Retransmissions continue on the T2-capped schedule: T1, then doubling up to T2 (4s), then every 4 seconds after that (compressed here)', 2500, {}),
        sig('A>B','OPTIONS',{direct:true, note:'One of several retransmissions, evenly spaced at the T2 ceiling.'}),
        wait('A', 'Timer F (64×T1 = 32 seconds total) elapses with no response at all', 2000, {}),
        sig('A>A','408 Request Timeout',{code:408, note:'Generated locally, exactly like Timer B\u2019s timeout — the transaction layer gives up after Timer F rather than retrying forever.', plain:'Timer F has run out with total silence from the far end, so the transaction is abandoned and reported as a timeout.', fix:'Repeated Timer F timeouts on keep-alives or other non-INVITE requests usually mean the far end is unreachable or not processing SIP at all — check basic network reachability first, then confirm the destination\u2019s SIP service is actually running and listening on the expected port.'})
      ];
    case 'sessionExpires':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Session-Expires: 1800;refresher=uac','Min-SE: 90','Supported: timer'], plain:'User A proposes a session timer: refresh every 1800 seconds, and states it will be the one responsible for sending that refresh (refresher=uac).'}),
        sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 1800;refresher=uac','Require: timer'], note:'User B agrees to the same interval and confirms who the refresher is — both sides now know exactly when a refresh must happen, and whose job it is to send it.', plain:'The session timer is now active: if User A doesn\u2019t send a refresh within roughly 1800 seconds, User B\u2019s side is entitled to consider the call dead and tear it down.'}),
        sig('A>B','ACK',{direct:true})
      ];
    case 'minSE':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Session-Expires: 60;refresher=uac','Supported: timer'], plain:'User A proposes a very short 60-second session interval.'}),
        sig('B>A','422 Session Interval Too Small',{code:422, direct:true, extraHeaders:['Min-SE: 90'], note:'422 specifically means the proposed Session-Expires was below what this side is willing to accept — and RFC 4028 requires the rejection to include Min-SE, telling the caller exactly what minimum would be acceptable.', plain:'User B rejects the interval as too short, but — helpfully — tells User A exactly what value would work.', fix:'This is normal, expected negotiation, not a fault: on receiving a 422, retry the INVITE with Session-Expires set to at least the Min-SE value provided. If this happens on every call to a particular destination, consider just configuring a higher default Session-Expires to skip the extra round trip.'}),
        sig('A>B','INVITE',{direct:true, extraHeaders:['Session-Expires: 90;refresher=uac','Min-SE: 90'], note:'User A retries with exactly the minimum User B stated.', plain:'This time the proposed interval meets the minimum, so the call can proceed.'}),
        sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 90;refresher=uac']}),
        sig('A>B','ACK',{direct:true})
      ];
    case 'refreshInterval':
      return [
        sig('A>B','INVITE',{firstRequest:true, direct:true, extraHeaders:['Session-Expires: 600;refresher=uac','Supported: timer'], plain:'A 600-second session interval is negotiated — meaning a refresh is recommended at or before roughly half that: 300 seconds.'}),
        sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 600;refresher=uac']}),
        sig('A>B','ACK',{direct:true}),
        media([['A','B']],'RTP — call in progress',4000,{}),
        wait('A', 'Roughly half the interval passes — about 300 seconds in real time (compressed here)', 2200, {note:'RFC 4028 recommends refreshing at or before half of Session-Expires specifically so a single lost refresh attempt still leaves time to retry before the session actually expires.'}),
        sig('A>B','UPDATE',{direct:true, extraHeaders:['Session-Expires: 600;refresher=uac'], plain:'Right on schedule — at the halfway point, not at the last moment — User A sends the refresh.'}),
        sig('B>A','200 OK',{code:200, direct:true, extraHeaders:['Session-Expires: 600;refresher=uac'], plain:'The session timer resets for another full 600 seconds.'}),
        media([['A','B']],'RTP — call in progress',3000,{}),
        sig('A>B','BYE',{direct:true, teardown:true}),
        sig('B>A','200 OK',{code:200, direct:true, teardown:true})
      ];
    default:
      return [ sig('A>B','INVITE',{firstRequest:true, direct:true}) ];
  }
}
function regenerateTimer(key){
  const info = TIMER_INFO[key] || {label:'SIP Timer'};
  const baseSteps = generateTimerSteps(key);
  SCENARIOS.timersref.endpoints = ['A','B'];
  SCENARIOS.timersref.steps = baseSteps;
  SCENARIOS.timersref.name = info.label;
}

/* =========================================================
   SHAREABLE DEEP-LINK URLS
========================================================= */
function buildShareableHash(){
  const params = new URLSearchParams();
  params.set('s', scenarioKey);
  if(callType!=='internal') params.set('ct', callType);
  if(callDirection!=='outbound') params.set('cd', callDirection);
  if(transportMode!=='udp') params.set('tr', transportMode);
  if(faultMode!=='none') params.set('mf', faultMode);
  if(signalFaultMode!=='none') params.set('sf', signalFaultMode);
  if(scenarioKey==='respcode') params.set('code', codeSelect.value);
  if(scenarioKey==='sdpparam') params.set('sdp', sdpSelect.value);
  if(scenarioKey==='timersref') params.set('timer', timerSelect.value);
  if(scenarioKey==='custom'){
    const p = getCbParams();
    if(p.name) params.set('cbname', p.name);
    params.set('cbtype', p.callType);
    params.set('cbdir', p.direction);
    params.set('cbtr', p.transport);
    params.set('cbpbx', String(p.numPbx));
    params.set('cbfw', p.firewall.enabled ? '1' : '0');
    if(p.firewall.enabled){
      params.set('cbfwpos', p.firewall.position);
      params.set('cbfwbeh', p.firewall.behavior);
    }
    params.set('cbcodec', p.codec);
    params.set('cboutcome', p.outcome);
  }
  return params.toString();
}
function copyShareableLink(){
  const hash = buildShareableHash();
  const url = window.location.origin + window.location.pathname + '#' + hash;
  try { history.replaceState(null, '', '#'+hash); } catch(e){}
  const showToast = () => {
    const btn = document.getElementById('shareLinkBtn');
    const toast = document.getElementById('shareLinkToast');
    if(btn) btn.classList.add('copied');
    if(toast) toast.classList.add('show');
    setTimeout(()=>{
      if(btn) btn.classList.remove('copied');
      if(toast) toast.classList.remove('show');
    }, 1800);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(showToast).catch(()=>{ fallbackCopy(url); showToast(); });
  } else {
    fallbackCopy(url);
    showToast();
  }
}
function fallbackCopy(text){
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(e){}
}
function restoreFromUrlHash(){
  try{
    const hash = window.location.hash.replace(/^#/, '');
    if(!hash) return false;
    const params = new URLSearchParams(hash);
    const s = params.get('s');
    if(!s || !SCENARIO_TEMPLATES[s]) return false;

    callType = params.get('ct') || 'internal';
    callDirection = params.get('cd') || 'outbound';
    transportMode = params.get('tr') || 'udp';
    faultMode = params.get('mf') || 'none';
    signalFaultMode = params.get('sf') || 'none';

    if(s==='custom'){
      const cbType = params.get('cbtype') || 'internal';
      const cbDir = params.get('cbdir') || 'outbound';
      const cbTr = params.get('cbtr') || 'udp';
      document.getElementById('cbName').value = params.get('cbname') || '';
      document.querySelectorAll('.cb-btn[data-group="callType"]').forEach(b=>b.classList.toggle('active', b.dataset.value===cbType));
      document.querySelectorAll('.cb-btn[data-group="direction"]').forEach(b=>b.classList.toggle('active', b.dataset.value===cbDir));
      document.querySelectorAll('.cb-btn[data-group="transport"]').forEach(b=>b.classList.toggle('active', b.dataset.value===cbTr));
      document.getElementById('cbPbxCount').value = params.get('cbpbx') || '1';
      const fwEnabled = params.get('cbfw')==='1';
      document.getElementById('cbFirewallEnabled').checked = fwEnabled;
      if(fwEnabled){
        document.getElementById('cbFirewallPosition').value = params.get('cbfwpos') || 'middle';
        document.getElementById('cbFirewallBehavior').value = params.get('cbfwbeh') || 'block';
      }
      document.getElementById('cbCodec').value = params.get('cbcodec') || 'opus';
      document.getElementById('cbOutcome').value = params.get('cboutcome') || 'success';
      document.getElementById('cbFirewallOptions').style.display = fwEnabled ? 'block' : 'none';
      updateCbPreview();
      runCustomBuilder(getCbParams());
      switchScenario('custom');
    } else {
      switchScenario(s);
      if(s==='respcode' && params.get('code')){ codeSelect.value = params.get('code'); regenerateRespCode(codeSelect.value); }
      if(s==='sdpparam' && params.get('sdp')){ sdpSelect.value = params.get('sdp'); regenerateSdpParam(sdpSelect.value); }
      if(s==='timersref' && params.get('timer')){ timerSelect.value = params.get('timer'); regenerateTimer(timerSelect.value); }
    }

    faultSelect.value = faultMode;
    signalFaultSelect.value = signalFaultMode;
    updateFaultStatus();
    buildCallTypeUI();
    buildCallDirectionUI();
    buildTransportUI();
    updateSelMeta();
    buildColumns();
    computeLayout();
    resetState();
    return true;
  }catch(e){ return false; }
}

function generateSdpParamSteps(key){
  const info = SDP_PARAMS[key] || {line:'', desc:'An SDP attribute.'};
  return [
    sig('A>P','INVITE',{firstRequest:true, sdp:{raw:[info.line]}, plain:info.desc}),
    sig('P>P','100 Trying',{code:100}),
    sig('P>B','INVITE',{sdp:{raw:[info.line]}}),
    sig('B>P','200 OK',{code:200, sdp:{raw:['(answer SDP omitted for clarity)']}}),
    sig('P>A','200 OK',{code:200}),
    sig('A>P','ACK',{})
  ];
}
function regenerateSdpParam(key){
  const info = SDP_PARAMS[key] || {label:'SDP parameter'};
  const baseSteps = propagateRelayedSdp(generateSdpParamSteps(key));
  const dirResult = applyCallDirection(baseSteps, ['A','P','B'], callDirection);
  const {steps, endpoints} = applyCallType(dirResult.steps, dirResult.endpoints, callType, callDirection);
  SCENARIOS.sdpparam.endpoints = endpoints;
  SCENARIOS.sdpparam.steps = steps;
  SCENARIOS.sdpparam.name = info.label;
}

/* =========================================================
   STATE
========================================================= */
let categoryKey = 'core';
let scenarioKey = 'standard';
let playing = false;
let speed = 1;
let stepIndex = -1;
let currentGlowEl = null;
let elapsedMs = 0;
let rafId = null;
let lastFrameTs = null;
let stepTimer = null;
let mediaInterval = null;
let logEntries = [];
let sessionCallId = '';
let theme = 'dark';
let stepTimestamps = {};
let activeTab = 'overview';
let faultMode = 'none';
let lastSelectedStep = -1;

const COL_ROW_H = 78;
const WAIT_ROW_H = 96;
const TRANSIT_MS = 950;

const categorySelect = document.getElementById('categorySelect');
const scenarioSelect = document.getElementById('scenarioSelect');
const scenarioSearch = document.getElementById('scenarioSearch');
const searchResults = document.getElementById('searchResults');
const scenarioField = document.getElementById('scenarioField');
const selMeta = document.getElementById('selMeta');
const scrollArea = document.getElementById('scrollArea');
const diagramHscroll = document.getElementById('diagramHscroll');
const diagramInner = document.getElementById('diagramInner');
const colHeadersEl = document.getElementById('colHeaders');
const lifelinesEl = document.getElementById('lifelines');
const svg = document.getElementById('evtSvg');
const inspBody = document.getElementById('inspBody');
const inspTabs = document.getElementById('inspTabs');
const msgTag = document.getElementById('msgTag');
const logBody = document.getElementById('logBody');
const logCount = document.getElementById('logCount');
const clockVal = document.getElementById('clockVal');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('restartBtn');
const speedGroup = document.getElementById('speedGroup');
const themeBtn = document.getElementById('themeBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const codePicker = document.getElementById('codePicker');
const codeSelect = document.getElementById('codeSelect');
const sdpPicker = document.getElementById('sdpPicker');
const sdpSelect = document.getElementById('sdpSelect');
const timerPicker = document.getElementById('timerPicker');
const timerSelect = document.getElementById('timerSelect');
const faultSelect = document.getElementById('faultSelect');
const signalFaultSelect = document.getElementById('signalFaultSelect');
const summaryCard = document.getElementById('summaryCard');
const exportLogBtn = document.getElementById('exportLogBtn');

const CATEGORY_ICON = {
  core:'📞', transfer:'🔀', forwarding:'↪️', multiparty:'👥',
  faxdtmf:'📠', sdp:'🧩', audioissues:'🎧', carrier:'🛰️', errors:'⚠️', methods:'⚙️', reference:'📖',
  presence:'💡', timers:'⏱️', nat:'🧊', custom:'🛠️'
};

/* =========================================================
   BUILD NAV — cascading dropdowns (category → simulation)
========================================================= */
function updateSelectTitle(selectEl){
  if(selectEl && selectEl.selectedIndex>=0) selectEl.title = selectEl.options[selectEl.selectedIndex].textContent;
}
function buildCategorySelect(){
  categorySelect.innerHTML = '';
  CATEGORIES.forEach(c=>{
    const n = scenariosInCategory(c.id).length;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (CATEGORY_ICON[c.id]||'') + ' ' + c.label + ' (' + n + ')';
    categorySelect.appendChild(opt);
  });
  categorySelect.value = categoryKey;
  updateSelectTitle(categorySelect);
}
function buildScenarioSelect(){
  const list = scenariosInCategory(categoryKey);
  scenarioSelect.innerHTML = '';
  list.forEach(key=>{
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SCENARIOS[key].name;
    scenarioSelect.appendChild(opt);
  });
  scenarioSelect.value = scenarioKey;
  updateSelectTitle(scenarioSelect);
  const onlyOne = list.length<=1;
  scenarioField.style.display = onlyOne ? 'none' : '';
  document.getElementById('selGrid').classList.toggle('single', onlyOne);
}

/* =========================================================
   SEARCH — quick lookup across every scenario, regardless of
   category, without needing to know where it lives.
========================================================= */
function buildSearchIndex(){
  return Object.keys(SCENARIO_TEMPLATES).map(key=>{
    const tpl = SCENARIO_TEMPLATES[key];
    const cat = CATEGORIES.find(c=>c.id===tpl.category);
    return { key, name: tpl.name, categoryId: tpl.category, categoryLabel: cat ? cat.label : tpl.category };
  });
}
const SEARCH_INDEX = buildSearchIndex();
function runSearch(query){
  const q = query.trim().toLowerCase();
  if(!q) return [];
  return SEARCH_INDEX.filter(item=>
    item.name.toLowerCase().indexOf(q)>=0 || item.categoryLabel.toLowerCase().indexOf(q)>=0
  ).slice(0, 10);
}
function renderSearchResults(query){
  const results = runSearch(query);
  if(!query.trim()){
    searchResults.style.display = 'none';
    searchResults.innerHTML = '';
    return;
  }
  if(!results.length){
    searchResults.innerHTML = '<div class="search-empty">No simulations match “'+query.trim()+'”.</div>';
  } else {
    searchResults.innerHTML = results.map((r,i)=>
      '<div class="search-result'+(i===0?' hl':'')+'" data-key="'+r.key+'">'+
        '<span class="sr-name">'+(CATEGORY_ICON[r.categoryId]||'')+' '+r.name+'</span>'+
        '<span class="sr-cat">'+r.categoryLabel+'</span>'+
      '</div>'
    ).join('');
    Array.from(searchResults.querySelectorAll('.search-result')).forEach(el=>{
      el.onclick = ()=>{
        switchScenario(el.dataset.key);
        scenarioSearch.value = '';
        searchResults.style.display = 'none';
      };
    });
  }
  searchResults.style.display = 'block';
}
function updateSelMeta(){
  const sc = SCENARIOS[scenarioKey];
  const cat = CATEGORIES.find(c=>c.id===sc.category);
  const stepCount = sc.isSdpExplorer ? '(varies by parameter)' : sc.isTimerExplorer ? '(varies by timer)' : sc.isExplorer ? '(varies by code)' : sc.steps.length + ' steps';
  const ctChip = scenarioSupportsCallType(scenarioKey) ? '<span class="chip">'+(callType==='external'?'🌐 External':'🏢 Internal')+'</span>' : '';
  const cdChip = scenarioSupportsDirection(scenarioKey) ? '<span class="chip">'+(callDirection==='inbound'?'📥 Inbound':'📤 Outbound')+'</span>' : '';
  selMeta.innerHTML =
    '<span class="chip">' + (CATEGORY_ICON[sc.category]||'') + ' ' + (cat?cat.label:sc.category) + '</span>' +
    '<span class="chip">' + sc.endpoints.length + ' endpoints</span>' +
    '<span class="chip">' + stepCount + '</span>' + ctChip + cdChip;
}
function buildCallTypeUI(){
  const supported = scenarioSupportsCallType(scenarioKey);
  Array.from(document.querySelectorAll('.ct-btn')).forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.type===callType);
    btn.disabled = !supported;
  });
}
function buildCallDirectionUI(){
  const supported = scenarioSupportsDirection(scenarioKey);
  Array.from(document.querySelectorAll('.cd-btn')).forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.dir===callDirection);
    btn.disabled = !supported;
  });
}
function buildTransportUI(){
  Array.from(document.querySelectorAll('.tr-btn')).forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.transport===transportMode);
  });
}
function setTransport(mode){
  if(transportMode===mode) return;
  transportMode = mode;
  buildTransportUI();
  buildColumns();
  if(lastSelectedStep>=0) selectStep(lastSelectedStep);
}
function setCallType(mode){
  if(callType===mode) return;
  callType = mode;
  const tpl = SCENARIO_TEMPLATES[scenarioKey];
  if(tpl.isSdpExplorer) regenerateSdpParam(sdpSelect.value);
  else if(tpl.isTimerExplorer) regenerateTimer(timerSelect.value);
  else if(tpl.isExplorer) regenerateRespCode(codeSelect.value);
  else rebuildScenario(scenarioKey);
  buildCallTypeUI();
  updateSelMeta();
  buildColumns();
  computeLayout();
  resetState();
}
function setCallDirection(dir){
  if(callDirection===dir) return;
  callDirection = dir;
  const tpl = SCENARIO_TEMPLATES[scenarioKey];
  if(tpl.isSdpExplorer) regenerateSdpParam(sdpSelect.value);
  else if(tpl.isTimerExplorer) regenerateTimer(timerSelect.value);
  else if(tpl.isExplorer) regenerateRespCode(codeSelect.value);
  else rebuildScenario(scenarioKey);
  buildCallDirectionUI();
  updateSelMeta();
  buildColumns();
  computeLayout();
  resetState();
}
function setSignalFault(mode){
  if(signalFaultMode===mode) return;
  signalFaultMode = mode;
  const tpl = SCENARIO_TEMPLATES[scenarioKey];
  if(!tpl.isExplorer) rebuildScenario(scenarioKey);
  buildColumns();
  computeLayout();
  resetState();
  updateFaultStatus();
}
function activeFaultSummary(){
  const parts = [];
  if(faultMode!=='none') parts.push('Media: '+faultSelect.options[faultSelect.selectedIndex].text);
  if(signalFaultMode!=='none') parts.push('Signaling: '+signalFaultSelect.options[signalFaultSelect.selectedIndex].text);
  return parts;
}
function updateFaultStatus(){
  const el = document.getElementById('faultStatus');
  const clearBtn = document.getElementById('clearFaultsBtn');
  const clearBtn2 = document.getElementById('clearFaultsBtn2');
  if(!el) return;
  const parts = activeFaultSummary();
  const anyActive = parts.length>0;
  if(anyActive){
    el.textContent = parts.join(' · ');
    el.classList.add('active');
  } else {
    el.textContent = 'No faults active';
    el.classList.remove('active');
  }
  if(clearBtn) clearBtn.style.display = anyActive ? '' : 'none';
  if(clearBtn2) clearBtn2.style.display = anyActive ? '' : 'none';
  const railDot = document.getElementById('railFaultDot');
  if(railDot) railDot.style.display = anyActive ? 'block' : 'none';
  updateRunningFaultBadge();
}
function updateRunningFaultBadge(){
  const badge = document.getElementById('runFaultBadge');
  if(!badge) return;
  const parts = activeFaultSummary();
  if(parts.length){
    badge.textContent = '⚠ ' + parts.join(' · ');
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}
function clearAllFaults(){
  faultMode = 'none';
  faultSelect.value = 'none';
  if(signalFaultMode!=='none'){
    signalFaultSelect.value = 'none';
    setSignalFault('none');
  } else {
    if(lastSelectedStep>=0) selectStep(lastSelectedStep);
    updateFaultStatus();
  }
}
/* =========================================================
   ONBOARDING TOUR
========================================================= */
const TOUR_STEPS = [
  { selector: null, title: 'Welcome to the SIP Call Flow Simulator', text: 'A quick tour of what this tool can do — seven short steps, skip anytime.' },
  { selector: '#selGrid', title: 'Find any scenario', text: 'Search across 47 built-in scenarios, or browse by category and simulation.' },
  { selector: '#callTypeRow', title: 'Configure the call', text: 'Choose Internal or External, Inbound or Outbound, and the transport — UDP, TCP, or TLS.' },
  { selector: '.playback-bar', title: 'Press Play', text: 'Watch the call unfold message by message. Speed it up, slow it down, or restart anytime.' },
  { selector: '#mainGrid', title: 'Inspect every packet', text: 'Click any arrow in the diagram, or any row in the capture log, to see it as plain English, raw SIP, or SDP.' },
  { selector: '#faultRailTarget', title: 'Break things on purpose', text: 'Inject a media or signaling fault onto any scenario and get an instant, plain-English root-cause explanation.' },
  { selector: '#openBuilderBtn', title: 'Build your own', text: 'Design a custom topology — PBX hops, a firewall, your own outcome — and run it through the very same analyzer.' }
];
let tourStepIndex = 0;
function positionTourStep(index){
  const step = TOUR_STEPS[index];
  const spotlight = document.getElementById('tourSpotlight');
  const card = document.getElementById('tourCard');
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourText').textContent = step.text;
  document.getElementById('tourStepCount').textContent = (index+1)+' / '+TOUR_STEPS.length;
  document.getElementById('tourBackBtn').style.visibility = index===0 ? 'hidden' : 'visible';
  document.getElementById('tourNextBtn').textContent = index===TOUR_STEPS.length-1 ? 'Done' : 'Next';

  const target = step.selector ? document.querySelector(step.selector) : null;
  if(!target){
    spotlight.style.display = 'none';
    card.style.transform = 'translate(-50%,-50%)';
    card.style.top = '42%';
    card.style.left = '50%';
    return;
  }
  target.scrollIntoView({block:'center'});
  requestAnimationFrame(()=>{
    const r = target.getBoundingClientRect();
    const pad = 8;
    spotlight.style.display = 'block';
    spotlight.style.top = (r.top-pad)+'px';
    spotlight.style.left = (r.left-pad)+'px';
    spotlight.style.width = (r.width+pad*2)+'px';
    spotlight.style.height = (r.height+pad*2)+'px';
    card.style.transform = 'none';
    const cardH = card.offsetHeight || 150;
    const cardW = card.offsetWidth || 330;
    let top = r.bottom + 16;
    if(top + cardH > window.innerHeight - 12) top = Math.max(12, r.top - cardH - 16);
    let left = Math.min(Math.max(12, r.left), window.innerWidth - cardW - 12);
    card.style.top = top+'px';
    card.style.left = left+'px';
  });
}
function startTour(){
  tourStepIndex = 0;
  const appShell = document.getElementById('appShell');
  if(appShell) appShell.classList.remove('sidebar-collapsed');
  document.getElementById('tourOverlay').style.display = 'block';
  positionTourStep(0);
}
function endTour(){
  document.getElementById('tourOverlay').style.display = 'none';
  try { localStorage.setItem('sipSimTourSeen', '1'); } catch(e){}
}
function nextTourStep(){
  if(tourStepIndex >= TOUR_STEPS.length-1){ endTour(); return; }
  tourStepIndex++;
  positionTourStep(tourStepIndex);
}
function prevTourStep(){
  if(tourStepIndex<=0) return;
  tourStepIndex--;
  positionTourStep(tourStepIndex);
}

function resetAllOptions(){
  pause();
  faultMode = 'none';
  faultSelect.value = 'none';
  signalFaultMode = 'none';
  signalFaultSelect.value = 'none';
  callType = 'internal';
  callDirection = 'outbound';
  transportMode = 'udp';
  speed = 1;
  scenarioSearch.value = '';
  searchResults.style.display = 'none';
  Array.from(document.querySelectorAll('details.collapse-panel')).forEach(d=> d.open = false);
  buildSpeedGroup();
  resetCustomBuilderForm();

  const builderOpen = document.getElementById('customBuilderView').style.display !== 'none';
  if(builderOpen){
    // Stay on the builder page — just clear its form back to defaults, don't navigate away.
    updateFaultStatus();
    return;
  }

  switchScenario('standard');
  updateFaultStatus();
}
function resetCustomBuilderForm(){
  document.getElementById('cbName').value = '';
  document.getElementById('cbPbxCount').value = '1';
  document.getElementById('cbFirewallEnabled').checked = false;
  document.getElementById('cbFirewallOptions').style.display = 'none';
  document.getElementById('cbFirewallPosition').value = 'middle';
  document.getElementById('cbFirewallBehavior').value = 'passthrough';
  document.getElementById('cbCodec').value = 'opus';
  document.getElementById('cbOutcome').value = 'success';
  const cbDefaults = {callType:'internal', direction:'outbound', transport:'udp'};
  Array.from(document.querySelectorAll('.cb-btn')).forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.value === cbDefaults[btn.dataset.group]);
  });
  updateCbPreview();
}
function buildSpeedGroup(){
  speedGroup.innerHTML = '';
  [0.5,1,2].forEach(s=>{
    const b = document.createElement('div');
    b.className = 'speed-btn' + (s===speed?' active':'');
    b.textContent = s+'×';
    b.onclick = ()=>{ speed = s; buildSpeedGroup(); };
    speedGroup.appendChild(b);
  });
}

/* =========================================================
   COLUMN LAYOUT (dynamic per scenario — fixes the alignment issue)
========================================================= */
function activeEndpoints(){ return SCENARIOS[scenarioKey].endpoints; }
function xFor(id){
  const eps = activeEndpoints();
  const idx = eps.indexOf(id);
  return (idx+0.5)/eps.length*1000;
}
function buildColumns(){
  const eps = activeEndpoints();
  colHeadersEl.innerHTML = '';
  lifelinesEl.innerHTML = '';
  diagramInner.style.minWidth = Math.max(480, eps.length*150) + 'px';
  eps.forEach((id,idx)=>{
    const ep = ENDPOINTS[id];
    const head = document.createElement('div');
    head.className = 'col-head';
    head.innerHTML = `<div class="ep-icon">${ep.icon||'📡'}</div><div class="id">${ep.label}</div><div class="ip">${ep.ip}${ep.port?':'+portForEndpoint(id):''}</div>`;
    colHeadersEl.appendChild(head);

    const line = document.createElement('div');
    line.className = 'lifeline';
    line.style.left = ((idx+0.5)/eps.length*100) + '%';
    lifelinesEl.appendChild(line);
  });
}

/* =========================================================
   ROW LAYOUT (vertical offsets)
========================================================= */
let layout = [];
function rowHeight(step){
  if(step.kind==='media') return 74 + (step.pairs?step.pairs.length:1)*46;
  if(step.kind==='wait') return WAIT_ROW_H;
  return COL_ROW_H;
}
function computeLayout(){
  const steps = SCENARIOS[scenarioKey].steps;
  let y = 20;
  layout = [];
  steps.forEach(step=>{
    const h = rowHeight(step);
    layout.push({y,h});
    y += h;
  });
  const totalH = y + 30;
  svg.setAttribute('height', totalH);
  svg.style.height = totalH + 'px';
  svg.setAttribute('viewBox', `0 0 1000 ${totalH}`);
  lifelinesEl.style.height = totalH+'px';
}

/* =========================================================
   TONE (theme-reactive colors via CSS variables)
========================================================= */
function tone(step){
  if(step.kind==='wait') return 'var(--muted)';
  if(step.kind==='media') return step.held ? 'var(--dim)' : 'var(--media)';
  if(step.rtpEvent) return 'var(--media)';
  if(step.rawPacket) return 'var(--sig-dim)';
  if(step.teardown) return 'var(--teardown)';
  return 'var(--sig)';
}

/* =========================================================
   RESET / SWITCH
========================================================= */
function resetState(){
  pause();
  stepIndex = -1;
  elapsedMs = 0;
  logEntries = [];
  logRowsByIndex = {};
  stepTimestamps = {};
  activeTab = 'overview';
  lastSelectedStep = -1;
  sessionCallId = 'sess-' + scenarioKey + '-' + Math.floor(Math.random()*90000+10000) + '@192.168.1.100';
  svg.innerHTML = '';
  currentGlowEl = null;
  logBody.innerHTML = '';
  logCount.textContent = '0 packets';
  inspBody.innerHTML = '<div class="empty">Press Play — the first packet detail will appear here.</div>';
  msgTag.style.display = 'none';
  inspTabs.style.display = 'none';
  summaryCard.style.display = 'none';
  clockVal.textContent = '00:00.0';
  playBtn.innerHTML = '▶ &nbsp;Play';
  scrollArea.scrollTop = 0;
  diagramHscroll.scrollLeft = 0;
  requestAnimationFrame(()=>{ scrollArea.scrollTop = 0; diagramHscroll.scrollLeft = 0; });
  const runningIndicator = document.getElementById('runningIndicator');
  if(runningIndicator) runningIndicator.style.display = 'none';
}
function switchScenario(key){
  scenarioKey = key;
  categoryKey = SCENARIOS[key].category;
  categorySelect.value = categoryKey;
  updateSelectTitle(categorySelect);
  buildScenarioSelect();
  if(!SCENARIO_TEMPLATES[key].isExplorer) rebuildScenario(key);
  codePicker.style.display = (SCENARIOS[key].isExplorer && !SCENARIOS[key].isSdpExplorer && !SCENARIOS[key].isTimerExplorer) ? 'block' : 'none';
  sdpPicker.style.display = SCENARIOS[key].isSdpExplorer ? 'block' : 'none';
  timerPicker.style.display = SCENARIOS[key].isTimerExplorer ? 'block' : 'none';
  buildCallTypeUI();
  buildCallDirectionUI();
  buildTransportUI();
  updateSelMeta();
  buildColumns();
  computeLayout();
  resetState();
}
function populateCodeSelect(){
  const groups = {'1xx':[], '2xx':[], '3xx':[], '4xx':[], '5xx':[], '6xx':[]};
  Object.keys(RESPONSE_REASONS).forEach(code=>{ groups[classOf(code)].push(code); });
  const labels = {'1xx':'1xx — Provisional', '2xx':'2xx — Success', '3xx':'3xx — Redirection', '4xx':'4xx — Client Error', '5xx':'5xx — Server Error', '6xx':'6xx — Global Failure'};
  codeSelect.innerHTML = '';
  Object.keys(groups).forEach(g=>{
    if(!groups[g].length) return;
    const og = document.createElement('optgroup');
    og.label = labels[g];
    groups[g].sort((a,b)=>Number(a)-Number(b)).forEach(code=>{
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code+' '+RESPONSE_REASONS[code].name;
      og.appendChild(opt);
    });
    codeSelect.appendChild(og);
  });
  codeSelect.value = '404';
}
function populateSdpSelect(){
  sdpSelect.innerHTML = '';
  Object.keys(SDP_PARAMS).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SDP_PARAMS[key].label;
    sdpSelect.appendChild(opt);
  });
  sdpSelect.value = 'm';
}
function populateTimerSelect(){
  timerSelect.innerHTML = '';
  const groups = [
    { label:'Core Transaction Timers (RFC 3261)', keys:['T1','T2','timerA','timerB','timerF'] },
    { label:'Session Timers (RFC 4028)', keys:['sessionExpires','minSE','refreshInterval'] }
  ];
  groups.forEach(g=>{
    const og = document.createElement('optgroup');
    og.label = g.label;
    g.keys.forEach(key=>{
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = TIMER_INFO[key].label;
      og.appendChild(opt);
    });
    timerSelect.appendChild(og);
  });
  timerSelect.value = 'T1';
}

/* =========================================================
   CLOCK
========================================================= */
function tickClock(){
  const s = Math.floor(elapsedMs/1000);
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  const ms = String(Math.floor((elapsedMs%1000)/100));
  clockVal.textContent = `${mm}:${ss}.${ms}`;
}
function clockRAF(ts){
  if(!playing) return;
  if(lastFrameTs!==null){ elapsedMs += (ts-lastFrameTs)*speed; tickClock(); }
  lastFrameTs = ts;
  rafId = requestAnimationFrame(clockRAF);
}

/* =========================================================
   PLAYBACK
========================================================= */
function play(){
  if(playing) return;
  const steps = SCENARIOS[scenarioKey].steps;
  if(stepIndex >= steps.length-1){ resetState(); }
  playing = true;
  playBtn.innerHTML = '⏸ &nbsp;Pause';
  lastFrameTs = null;
  rafId = requestAnimationFrame(clockRAF);
  scheduleNext();
  const runningIndicator = document.getElementById('runningIndicator');
  const runningScenarioName = document.getElementById('runningScenarioName');
  if(runningIndicator && runningScenarioName){
    runningScenarioName.textContent = SCENARIOS[scenarioKey].name;
    runningIndicator.style.display = 'flex';
    updateRunningFaultBadge();
  }
}
function pause(){
  playing = false;
  playBtn.innerHTML = '▶ &nbsp;Play';
  cancelAnimationFrame(rafId);
  clearTimeout(stepTimer);
  clearInterval(mediaInterval);
}
function stopSim(){ resetState(); }
function restartSim(){ resetState(); play(); }

function scheduleNext(){
  const steps = SCENARIOS[scenarioKey].steps;
  const next = stepIndex+1;
  if(next >= steps.length){
    playing=false; playBtn.innerHTML='↻ &nbsp;Replay'; cancelAnimationFrame(rafId);
    if(currentGlowEl){ currentGlowEl.classList.remove('step-current-glow'); currentGlowEl = null; }
    showCallSummary();
    return;
  }
  const gap = 500/speed;
  stepTimer = setTimeout(()=>{ runStep(next); }, gap);
}
function runStep(i){
  if(!playing) return;
  stepIndex = i;
  stepTimestamps[i] = elapsedMs;
  lastSelectedStep = i;
  const step = effectiveMediaStep(SCENARIOS[scenarioKey].steps[i]);
  drawStep(step, i);
  if(currentGlowEl) currentGlowEl.classList.remove('step-current-glow');
  currentGlowEl = (step.kind==='media') ? null : svg.lastElementChild;
  if(currentGlowEl) currentGlowEl.classList.add('step-current-glow');
  logStep(step, i);
  showInspector(step, i);
  scrollToStep(i);

  if(step.kind==='media'){
    runMediaStats(step);
    stepTimer = setTimeout(()=>{ clearInterval(mediaInterval); scheduleNext(); }, step.duration/speed);
  } else if(step.kind==='wait'){
    stepTimer = setTimeout(()=> scheduleNext(), step.duration/speed);
  } else {
    scheduleNext();
  }
}
function scrollToStep(i){
  const l = layout[i];
  if(!l) return;
  scrollArea.scrollTo({top: Math.max(0,l.y-40), behavior:'smooth'});
}

/* =========================================================
   DRAW
========================================================= */
function truncate(s,n){ return s && s.length>n ? s.slice(0,n-1)+'…' : (s||''); }

function drawStep(step, i){
  const l = layout[i];
  const y = l.y + l.h/2;
  const ns = 'http://www.w3.org/2000/svg';
  const color = tone(step);

  if(step.kind==='media'){ drawMediaBlock(step, l, color, i); return; }
  if(step.kind==='wait'){ drawWaitBlock(step, l, color, i); return; }

  const [from,to] = step.dir.split('>');
  if(from===to){ drawSelfLoop(step, y, from, ns, color, i); return; }

  const eps = activeEndpoints();
  const skips = Math.abs(eps.indexOf(to)-eps.indexOf(from))>1;
  const x1 = xFor(from), x2 = xFor(to);
  const g = document.createElementNS(ns,'g');

  const hit = document.createElementNS(ns,'line');
  hit.setAttribute('x1',x1); hit.setAttribute('y1',y);
  hit.setAttribute('x2',x2); hit.setAttribute('y2',y);
  hit.setAttribute('stroke','transparent'); hit.setAttribute('stroke-width','26');
  g.appendChild(hit);

  const line = document.createElementNS(ns,'line');
  line.setAttribute('x1',x1); line.setAttribute('y1',y);
  line.setAttribute('x2',x2); line.setAttribute('y2',y);
  line.setAttribute('stroke', color); line.setAttribute('stroke-width',1.6);
  if(skips) line.setAttribute('stroke-dasharray','2,4');
  line.setAttribute('opacity','0');
  g.appendChild(line);

  const dir = x2>x1 ? 1 : -1;
  const head = document.createElementNS(ns,'polygon');
  const hx = x2 - dir*10;
  head.setAttribute('points', `${x2},${y} ${hx},${y-5} ${hx},${y+5}`);
  head.setAttribute('fill', color); head.setAttribute('opacity','0');
  g.appendChild(head);

  const label = document.createElementNS(ns,'text');
  label.setAttribute('x',(x1+x2)/2); label.setAttribute('y', y-10);
  label.setAttribute('text-anchor','middle'); label.setAttribute('font-size','12.5');
  label.setAttribute('font-weight','700'); label.setAttribute('fill',color);
  label.appendChild(document.createTextNode(displayLabel(step)));
  if(hasSdpBody(step)){
    const tag = document.createElementNS(ns,'tspan');
    tag.setAttribute('fill','var(--sig)');
    tag.setAttribute('font-size','9.5');
    tag.setAttribute('font-weight','700');
    tag.textContent = '  ◆ SDP';
    label.appendChild(tag);
  }
  label.setAttribute('opacity','0');
  g.appendChild(label);

  if(step.note){
    const note = document.createElementNS(ns,'text');
    note.setAttribute('x',(x1+x2)/2); note.setAttribute('y', y+18);
    note.setAttribute('text-anchor','middle'); note.setAttribute('font-size','9.5');
    note.setAttribute('fill','var(--muted)');
    note.textContent = truncate(step.note, 58); note.setAttribute('opacity','0');
    g.appendChild(note);
  }

  const echo = document.createElementNS(ns,'circle');
  echo.setAttribute('r',6.5); echo.setAttribute('cy',y); echo.setAttribute('cx',x1);
  echo.setAttribute('fill',color); echo.setAttribute('class','pkt-echo');
  g.appendChild(echo);

  const dot = document.createElementNS(ns,'circle');
  dot.setAttribute('r',4.5); dot.setAttribute('cy',y); dot.setAttribute('cx',x1);
  dot.setAttribute('fill',color);
  g.appendChild(dot);

  svg.appendChild(g);
  g.style.cursor = 'pointer';
  g.addEventListener('click', ()=> selectStep(i));

  requestAnimationFrame(()=>{
    [line,head,label].forEach(el=>{ el.style.transition='opacity .2s ease'; });
    line.setAttribute('opacity','0.9'); head.setAttribute('opacity','0.95'); label.setAttribute('opacity','1');
    if(g.children.length>6){
      const n = g.children[3];
      if(n.tagName==='text'){ n.style.transition='opacity .2s ease'; n.setAttribute('opacity','0.85'); }
    }
    const travel = TRANSIT_MS/speed;
    const echoDelay = 90/speed;
    dot.style.transition = `cx ${travel}ms cubic-bezier(.4,0,.2,1)`;
    echo.style.transition = `cx ${travel}ms cubic-bezier(.4,0,.2,1) ${echoDelay}ms`;
    requestAnimationFrame(()=>{ dot.setAttribute('cx', x2); echo.setAttribute('cx', x2); });
    setTimeout(()=>{
      dot.style.transition='opacity .25s ease'; dot.setAttribute('opacity','0');
      echo.style.transition='opacity .25s ease'; echo.setAttribute('opacity','0');
      spawnBurst(x2, y, color);
    }, travel);
  });
}

function spawnBurst(x, y, color){
  const ns = 'http://www.w3.org/2000/svg';
  const bg = document.createElementNS(ns,'g');
  const flash = document.createElementNS(ns,'circle');
  flash.setAttribute('cx',x); flash.setAttribute('cy',y); flash.setAttribute('r',6);
  flash.setAttribute('fill',color); flash.setAttribute('class','pkt-burst');
  const ring = document.createElementNS(ns,'circle');
  ring.setAttribute('cx',x); ring.setAttribute('cy',y); ring.setAttribute('r',6);
  ring.setAttribute('fill','none'); ring.setAttribute('stroke',color);
  ring.setAttribute('class','pkt-burst-ring');
  bg.appendChild(ring); bg.appendChild(flash);
  svg.appendChild(bg);
  setTimeout(()=>{ if(bg.isConnected) bg.remove(); }, 650);
}

function drawSelfLoop(step, y, id, ns, color, i){
  const x = xFor(id);
  const g = document.createElementNS(ns,'g');
  const hit = document.createElementNS(ns,'circle');
  hit.setAttribute('cx', x+20); hit.setAttribute('cy', y); hit.setAttribute('r', 22);
  hit.setAttribute('fill','transparent');
  g.appendChild(hit);
  const path = document.createElementNS(ns,'path');
  path.setAttribute('d', `M ${x} ${y-8} C ${x+34} ${y-8}, ${x+34} ${y+8}, ${x} ${y+8}`);
  path.setAttribute('fill','none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width','1.6'); path.setAttribute('opacity','0');
  g.appendChild(path);
  const head = document.createElementNS(ns,'polygon');
  head.setAttribute('points', `${x},${y+8} ${x+8},${y+3} ${x+8},${y+13}`);
  head.setAttribute('fill', color); head.setAttribute('opacity','0');
  g.appendChild(head);
  const label = document.createElementNS(ns,'text');
  label.setAttribute('x', x+42); label.setAttribute('y', y+3);
  label.setAttribute('font-size','12.5'); label.setAttribute('font-weight','700'); label.setAttribute('fill', color);
  label.textContent = displayLabel(step) + '  (internal)'; label.setAttribute('opacity','0');
  g.appendChild(label);
  if(step.note){
    const note = document.createElementNS(ns,'text');
    note.setAttribute('x', x+42); note.setAttribute('y', y+18); note.setAttribute('font-size','9.5');
    note.setAttribute('fill','var(--muted)'); note.textContent = truncate(step.note,48); note.setAttribute('opacity','0');
    g.appendChild(note);
  }
  svg.appendChild(g);
  g.style.cursor = 'pointer';
  g.addEventListener('click', ()=> selectStep(i));
  requestAnimationFrame(()=>{
    Array.from(g.children).forEach(el=>{ el.style.transition='opacity .25s ease'; el.setAttribute('opacity', el.tagName==='path'?'0.9':'1'); });
  });
}

function drawWaitBlock(step, l, color, i){
  const ns='http://www.w3.org/2000/svg';
  const x = xFor(step.at);
  const y1 = l.y+14, y2 = l.y+l.h-14;
  const g = document.createElementNS(ns,'g');
  const hit = document.createElementNS(ns,'rect');
  hit.setAttribute('x', Math.max(0,x-220)); hit.setAttribute('y', l.y);
  hit.setAttribute('width', 440); hit.setAttribute('height', l.h);
  hit.setAttribute('fill','transparent');
  g.appendChild(hit);
  const bracket = document.createElementNS(ns,'path');
  bracket.setAttribute('d', `M ${x-10} ${y1} L ${x} ${y1} L ${x} ${y2} L ${x-10} ${y2}`);
  bracket.setAttribute('fill','none'); bracket.setAttribute('stroke', color); bracket.setAttribute('stroke-width','1.3'); bracket.setAttribute('stroke-dasharray','3,3');
  g.appendChild(bracket);

  // Long wait labels can overflow past the left edge when anchored near the
  // leftmost column (right-aligned text growing leftward from x-16). Flip to
  // a left-aligned label growing rightward from x+16 whenever the left side
  // doesn't have enough room for the text, using whichever side fits better.
  const fullLabel = '⏱ ' + step.label;
  const estCharW = 6.2; // approx SVG units per character at font-size 11 in the 1000-unit viewBox
  const estWidth = fullLabel.length * estCharW;
  const roomLeft = x - 16;
  const roomRight = 1000 - x - 16;
  const flipRight = roomLeft < estWidth && roomRight > roomLeft;

  const label = document.createElementNS(ns,'text');
  if(flipRight){ label.setAttribute('x', x+16); label.setAttribute('text-anchor','start'); }
  else { label.setAttribute('x', x-16); label.setAttribute('text-anchor','end'); }
  label.setAttribute('y', (y1+y2)/2);
  label.setAttribute('font-size','11'); label.setAttribute('font-weight','700'); label.setAttribute('fill', color);
  label.textContent = fullLabel;
  g.appendChild(label);
  if(step.note){
    const note = document.createElementNS(ns,'text');
    if(flipRight){ note.setAttribute('x', x+16); note.setAttribute('text-anchor','start'); }
    else { note.setAttribute('x', x-16); note.setAttribute('text-anchor','end'); }
    note.setAttribute('y', (y1+y2)/2+16);
    note.setAttribute('font-size','9.5'); note.setAttribute('fill','var(--dim)');
    note.textContent = truncate(step.note,52);
    g.appendChild(note);
  }
  svg.appendChild(g);
  g.style.cursor = 'pointer';
  g.addEventListener('click', ()=> selectStep(i));
}

function drawMediaBlock(step, l, color, i){
  const ns='http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns,'g');
  const hit = document.createElementNS(ns,'rect');
  hit.setAttribute('x', 0); hit.setAttribute('y', l.y);
  hit.setAttribute('width', 1000); hit.setAttribute('height', l.h);
  hit.setAttribute('fill','transparent');
  g.appendChild(hit);
  const perPairH = 46;
  const startY = l.y + 18;
  step.pairs.forEach((pair,pi)=>{
    const [from,to] = pair;
    const x1 = xFor(from), x2 = xFor(to);
    const yFwd = startY + pi*perPairH;
    const yBack = yFwd + 16;
    const fwdKey = from+'>'+to, backKey = to+'>'+from;
    const badColor = 'var(--teardown)';
    if(step.noaudio){
      drawBrokenFlow(g, x1, x2, yFwd, badColor);
      drawBrokenFlow(g, x2, x1, yBack, badColor);
    } else if(step.oneway===backKey){
      drawDashedFlow(g, x1, x2, yFwd, color);
      drawBrokenFlow(g, x2, x1, yBack, badColor);
    } else if(step.oneway===fwdKey){
      drawBrokenFlow(g, x1, x2, yFwd, badColor);
      drawDashedFlow(g, x2, x1, yBack, color);
    } else {
      drawDashedFlow(g, x1, x2, yFwd, color);
      drawDashedFlow(g, x2, x1, yBack, color);
    }
    const pl = document.createElementNS(ns,'text');
    pl.setAttribute('x',(x1+x2)/2); pl.setAttribute('y', yBack+12);
    pl.setAttribute('text-anchor','middle'); pl.setAttribute('font-size','9'); pl.setAttribute('fill','var(--dim)');
    pl.textContent = `${ENDPOINTS[from].label} ⇄ ${ENDPOINTS[to].label}`;
    g.appendChild(pl);
  });
  const label = document.createElementNS(ns,'text');
  label.setAttribute('x', 500); label.setAttribute('y', l.y + l.h - 14);
  label.setAttribute('text-anchor','middle'); label.setAttribute('font-size','12'); label.setAttribute('font-weight','700');
  label.setAttribute('fill', step.noaudio ? 'var(--teardown)' : color);
  label.textContent = step.label;
  g.appendChild(label);
  svg.appendChild(g);
  g.style.cursor = 'pointer';
  g.addEventListener('click', ()=> selectStep(i));
}
function drawBrokenFlow(g, x1, x2, y, color){
  const ns='http://www.w3.org/2000/svg';
  const dashLine = document.createElementNS(ns,'line');
  dashLine.setAttribute('x1',x1); dashLine.setAttribute('y1',y); dashLine.setAttribute('x2',x2); dashLine.setAttribute('y2',y);
  dashLine.setAttribute('stroke', color); dashLine.setAttribute('stroke-width','1.4'); dashLine.setAttribute('stroke-dasharray','2,6'); dashLine.setAttribute('opacity','0.45');
  g.appendChild(dashLine);
  const mx = (x1+x2)/2;
  const xmark = document.createElementNS(ns,'text');
  xmark.setAttribute('x', mx); xmark.setAttribute('y', y+4);
  xmark.setAttribute('text-anchor','middle'); xmark.setAttribute('font-size','13'); xmark.setAttribute('font-weight','700');
  xmark.setAttribute('fill', color);
  xmark.textContent = '✕';
  g.appendChild(xmark);
}
function drawFlowPulse(g, x1, x2, y, color){
  const ns='http://www.w3.org/2000/svg';
  const dir = x2>x1 ? 1 : -1;
  const w = 46;
  const streak = document.createElementNS(ns,'rect');
  streak.setAttribute('x', -w/2); streak.setAttribute('y', y-2.5);
  streak.setAttribute('width', w); streak.setAttribute('height', 5);
  streak.setAttribute('rx', 2.5);
  streak.setAttribute('fill', color);
  streak.setAttribute('opacity', '0.55');
  streak.style.filter = 'drop-shadow(0 0 5px ' + color + ')';
  const anim = document.createElementNS(ns,'animateTransform');
  anim.setAttribute('attributeName','transform');
  anim.setAttribute('type','translate');
  anim.setAttribute('from', (x1 - dir*w/2) + ',0');
  anim.setAttribute('to', (x2 + dir*w/2) + ',0');
  anim.setAttribute('dur', (1.15/speed) + 's');
  anim.setAttribute('repeatCount','indefinite');
  streak.appendChild(anim);
  g.appendChild(streak);
}
function drawDashedFlow(g, x1, x2, y, color){
  const ns='http://www.w3.org/2000/svg';
  drawFlowPulse(g, x1, x2, y, color);
  const dashLine = document.createElementNS(ns,'line');
  dashLine.setAttribute('x1',x1); dashLine.setAttribute('y1',y); dashLine.setAttribute('x2',x2); dashLine.setAttribute('y2',y);
  dashLine.setAttribute('stroke', color); dashLine.setAttribute('stroke-width','1.4'); dashLine.setAttribute('stroke-dasharray','5,5'); dashLine.setAttribute('opacity','0.55');
  g.appendChild(dashLine);
  for(let k=0;k<3;k++){
    const dot = document.createElementNS(ns,'circle');
    dot.setAttribute('r','3'); dot.setAttribute('cy',y); dot.setAttribute('fill', color);
    dot.dataset.delay = k*360; dot.dataset.x1 = x1; dot.dataset.x2 = x2;
    dot.setAttribute('cx', x1);
    g.appendChild(dot);
    animateMediaDot(dot);
  }
}
function animateMediaDot(dot){
  const start = performance.now();
  const period = 1300;
  function frame(now){
    if(!dot.isConnected) return;
    const delay = parseFloat(dot.dataset.delay)||0;
    const t = ((now-start)*speed + delay) % period / period;
    const x1 = parseFloat(dot.dataset.x1), x2 = parseFloat(dot.dataset.x2);
    dot.setAttribute('cx', x1 + (x2-x1)*t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* =========================================================
   MEDIA STATS
========================================================= */
function runMediaStats(step){
  clearInterval(mediaInterval);
  if(step.noaudio){
    const row = document.getElementById('statRow');
    if(row) row.innerHTML = `<div class="stat" style="border-color:var(--teardown)"><div class="label">RTP packets</div><div class="val" style="color:var(--teardown)">0 received</div></div>`;
    return;
  }
  const bad = !!step.degraded;
  const seed = bad ? {jitter:'28.0', loss:'4.20', rtt:130} : {jitter:2.0, loss:'0.00', rtt:24};
  updateStatsPanel(seed);
  mediaInterval = setInterval(()=>{
    const s = bad
      ? { jitter:(Math.random()*30+15).toFixed(1), loss:(Math.random()*6+2).toFixed(2), rtt:Math.floor(Math.random()*100+80) }
      : { jitter:(Math.random()*3+1).toFixed(1), loss:(Math.random()*0.4).toFixed(2), rtt:Math.floor(Math.random()*10+20) };
    updateStatsPanel(s);
  }, 700/speed);
}
function updateStatsPanel(s){
  const row = document.getElementById('statRow');
  if(!row) return;
  row.innerHTML = `
    <div class="stat"><div class="label">Jitter</div><div class="val">${s.jitter} ms</div></div>
    <div class="stat"><div class="label">Loss</div><div class="val">${s.loss}%</div></div>
    <div class="stat"><div class="label">RTT</div><div class="val">${s.rtt} ms</div></div>`;
}

/* =========================================================
   CALL SUMMARY
========================================================= */
function showCallSummary(){
  const steps = SCENARIOS[scenarioKey].steps;
  const sc = SCENARIOS[scenarioKey];
  const msgCount = steps.filter(s=>s.kind==='signal').length;
  const duration = fmtMs(elapsedMs);

  let codec = '—';
  steps.forEach(s=>{
    if(s.kind==='signal' && s.sdp && s.sdp.codecs){
      const acc = s.sdp.codecs.find(c=>/accepted|selected/i.test(c));
      if(acc) codec = acc.split('(')[0].replace(/—.*/,'').trim();
    }
  });

  const mediaSteps = steps.filter(s=>s.kind==='media');
  let mediaStatus = 'No media in this flow';
  if(mediaSteps.length){
    const bad = mediaSteps.some(s=>{ const es = effectiveMediaStep(s); return es.noaudio||es.oneway||es.degraded||es.transcodeArtifact; });
    mediaStatus = bad ? '⚠ Issue detected' : '✓ OK';
  }

  const issue = firstIssueIndex(steps);
  const resultCls = issue.severity==='hard' ? 'fail' : (issue.severity==='soft' ? 'warn' : 'pass');
  const resultWord = issue.severity==='hard' ? 'FAIL' : (issue.severity==='soft' ? 'PASS ⚠' : 'PASS');

  let reasonHtml = '';
  if(issue.index>=0){
    const failStep = effectiveMediaStep(steps[issue.index]);
    const isHard = issue.severity==='hard';
    const heading = isHard ? '❌ Why this call failed' : '⚠️ Why there was an issue';
    const label = displayLabel(steps[issue.index]);
    const reasonText = failStep.plain || plainFor(steps[issue.index]);
    reasonHtml = `
    <div class="summary-reason ${isHard?'hard':'soft'}">
      <div class="sr-label">${heading} — <b>${label}</b> (step #${issue.index+1})</div>
      <div class="sr-text">${reasonText}</div>
      ${failStep.fix ? `<div class="sr-fix"><b>Suggested fix:</b> ${failStep.fix}</div>` : ''}
    </div>`;
  }

  summaryCard.innerHTML = `
    <div class="summary-head">
      <span class="stitle">📋 Call Summary — ${sc.name}</span>
      <span class="summary-result ${resultCls}">${resultWord}</span>
    </div>
    <div class="summary-grid">
      <div class="summary-stat"><div class="label">Duration</div><div class="val">${duration}</div></div>
      <div class="summary-stat"><div class="label">SIP Messages</div><div class="val">${msgCount}</div></div>
      <div class="summary-stat"><div class="label">Negotiated Codec</div><div class="val">${codec}</div></div>
      <div class="summary-stat"><div class="label">Media</div><div class="val">${mediaStatus}</div></div>
    </div>
    ${reasonHtml}
    <div style="text-align:right;margin-top:10px;"><button class="summary-close" onclick="document.getElementById('summaryCard').style.display='none';">Dismiss ✕</button></div>
  `;
  summaryCard.style.display = 'block';
}

/* =========================================================
   EXPORT CAPTURE LOG
========================================================= */
function exportCaptureLog(){
  const steps = SCENARIOS[scenarioKey].steps;
  const entries = logEntries.map(e=>{
    const step = effectiveMediaStep(steps[e.i]);
    return {
      index: e.i+1,
      time: e.t,
      label: displayLabel(step),
      kind: step.kind,
      direction: step.kind==='signal' ? step.dir : (step.kind==='media' ? (step.pairs||[]).map(p=>p.join('>')).join(',') : step.at),
      code: step.code || null,
      plain: plainFor(step)
    };
  });
  const payload = {
    scenario: SCENARIOS[scenarioKey].name,
    category: SCENARIOS[scenarioKey].category,
    exportedAt: new Date().toISOString(),
    packetCount: entries.length,
    packets: entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sip-capture-' + scenarioKey + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

/* =========================================================
   LABELS
========================================================= */
function displayLabel(step){
  if(step.kind==='media') return step.label;
  if(step.kind==='wait') return '⏱ '+step.label;
  if(step.label) return step.label;
  if(step.code){
    const codeStr = String(step.code);
    if(step.method && step.method.indexOf(codeStr)===0) return step.method;
    return codeStr + ' ' + step.method;
  }
  return step.method;
}
function hasSdpBody(step){
  return !!(step.sdp && (step.sdp.c || step.sdp.m || step.sdp.raw || (step.sdp.codecs && step.sdp.codecs.length)));
}
function plainFor(step){
  if(step.plain) return step.plain;
  if(step.kind==='media') return 'Voice (or fax/data) now flows directly as a stream of small packets, roughly every 20 milliseconds, with a separate control channel (RTCP) reporting quality.';
  if(step.kind==='wait') return 'The system is waiting to see what happens next before deciding how to proceed.';
  const key = step.code ? String(step.code) : step.method;
  return PLAIN[key] || 'A protocol message keeps both sides in sync about the state of the call.';
}

/* =========================================================
   CSeq resolver (RFC 3261 §12.2 / §9 rules, simplified for a
   linear, well-ordered request→response step list)
========================================================= */
const INFRA_ENDPOINTS = {P:true, X:true, X2:true, P2:true, F:true, CP1:true, CP2:true, CP3:true, CFW:true};
function cseqInfo(steps, idx){
  const step = steps[idx];
  const key = step.callId || sessionCallId;
  let counter=0, lastInvite=0, lastReqMethod=null;
  for(let i=0;i<steps.length;i++){
    const s = steps[i];
    if(s.kind!=='signal') continue;
    const sKey = s.callId || sessionCallId;
    if(sKey!==key) continue;
    const [sFrom, sTo] = s.dir.split('>');
    if(sFrom===sTo){ if(i===idx) return {num:counter, method:lastReqMethod}; continue; }
    if(s.cseqOverride){ if(i===idx) return s.cseqOverride; continue; }
    const isRelayHop = INFRA_ENDPOINTS[sFrom] && (INFRA_ENDPOINTS[sTo] || sTo==='A' || sTo==='B');
    if(!s.code){
      if(isRelayHop){ if(i===idx) return {num:counter, method:lastReqMethod}; continue; }
      if(s.method==='ACK'){ if(i===idx) return {num:lastInvite, method:'INVITE'}; }
      else if(s.method==='CANCEL'){ lastReqMethod='CANCEL'; if(i===idx) return {num:lastInvite, method:'CANCEL'}; }
      else { counter++; if(s.method==='INVITE') lastInvite=counter; lastReqMethod=s.method; if(i===idx) return {num:counter, method:s.method}; }
    } else {
      if(i===idx) return { num:(lastReqMethod==='CANCEL'?lastInvite:counter), method:lastReqMethod };
    }
  }
  return {num:counter, method:lastReqMethod};
}

/* =========================================================
   TRANSACTION STATE, TIMING, ROOT CAUSE, FAULT INJECTION
========================================================= */
function dialogStateAt(steps, idx){
  let state = 'IDLE';
  for(let i=0;i<=idx;i++){
    const s = steps[i];
    if(s.kind!=='signal') continue;
    if(!s.code){
      if(s.method==='INVITE' && (state==='IDLE'||state==='RINGING')) state = (state==='IDLE') ? 'TRYING' : state;
      else if(s.method==='BYE') state = 'TERMINATING';
      else if(s.method==='CANCEL') state = 'CANCELLING';
    } else {
      const c = s.code;
      if(c>=100 && c<200){
        if(state==='TRYING'||state==='IDLE') state = (c===180||c===183||c===182) ? 'RINGING' : 'TRYING';
      } else if(c>=200 && c<300){
        if(state==='TERMINATING') state='TERMINATED';
        else if(state==='CANCELLING'||state==='CANCELLED') state='CANCELLED';
        else if(state!=='TERMINATED' && state!=='FAILED') state='ESTABLISHED';
      } else if(c>=300){
        if(c===401 || c===407){ /* auth challenge — expected mid-flow, not a terminal failure */ }
        else if(state!=='TERMINATED' && state!=='ESTABLISHED') state='FAILED';
      }
    }
  }
  return state;
}
function transactionTrail(steps, idx){
  const labels = [];
  for(let i=0;i<=idx;i++){
    const s = steps[i];
    if(s.kind!=='signal') continue;
    labels.push(s.code ? String(s.code) : s.method);
  }
  return labels;
}
function expectedNextFor(steps, idx){
  const state = dialogStateAt(steps, idx);
  const map = {
    IDLE:'INVITE (a request to start the call)',
    TRYING:'A provisional response (100 Trying / 180 Ringing) or a final response',
    RINGING:'A final response — 200 OK if answered, or an error/timeout if not',
    ESTABLISHED:'Media (RTP), or a mid-call request such as re-INVITE, BYE, or REFER',
    CANCELLING:'A response to the CANCEL, followed by a final non-2xx for the original INVITE',
    TERMINATING:'200 OK acknowledging the BYE',
    TERMINATED:'Nothing — this dialog has ended',
    CANCELLED:'A final non-2xx response (typically 487) for the original INVITE',
    FAILED:'Nothing further — this attempt has failed'
  };
  return map[state] || 'The next message in the flow';
}
function firstIssueIndex(steps){
  for(let i=0;i<steps.length;i++){
    const s = steps[i];
    if(s.recovered) continue;
    if(s.kind==='signal' && s.code && s.code>=400 && s.code!==401 && s.code!==407 && s.code!==422) return {index:i, severity:'hard'};
    if(s.kind==='signal' && s.flagIssue==='hard') return {index:i, severity:'hard'};
    if(s.kind==='media'){
      const es = effectiveMediaStep(s);
      if(es.noaudio || es.oneway) return {index:i, severity:'hard'};
    }
  }
  for(let i=0;i<steps.length;i++){
    const s = steps[i];
    if(s.recovered) continue;
    if(s.kind==='media'){
      const es = effectiveMediaStep(s);
      if(es.degraded || es.transcodeArtifact) return {index:i, severity:'soft'};
    }
    if(s.kind==='signal' && s.flagIssue==='soft') return {index:i, severity:'soft'};
  }
  return {index:-1, severity:null};
}
function firstFailureIndex(steps){
  const issue = firstIssueIndex(steps);
  return issue.severity==='hard' ? issue.index : -1;
}
function timingInfo(i){
  const t = stepTimestamps[i];
  if(t===undefined) return null;
  const prevIdx = Object.keys(stepTimestamps).map(Number).filter(k=>k<i).sort((a,b)=>b-a)[0];
  const nextIdx = Object.keys(stepTimestamps).map(Number).filter(k=>k>i).sort((a,b)=>a-b)[0];
  const fromPrev = prevIdx!==undefined ? t - stepTimestamps[prevIdx] : 0;
  const toNext = nextIdx!==undefined ? stepTimestamps[nextIdx] - t : null;
  return { elapsed:t, fromPrev, toNext, hasNext: nextIdx!==undefined };
}
function fmtMs(ms){
  if(ms<1000) return Math.round(ms)+' ms';
  return (ms/1000).toFixed(1)+' s';
}
function delayTone(ms){
  if(ms<500) return {word:'Normal', cls:''};
  if(ms<3000) return {word:'Noticeable', cls:'warn'};
  return {word:'Long delay', cls:'bad'};
}
const FAULT_OVERRIDES = {
  oneway: {oneway:'A>B', noaudio:false, degraded:false, forcedNote:'A fault was injected on this media stream: one-way audio only, using the “Inject fault” control.',
    fix:'Start with a packet capture on both endpoints to see which direction of RTP is actually missing. Common causes: a firewall or ACL blocking UDP in one direction only, a NAT device that isn\u2019t translating the return path correctly, or an SDP answer advertising the wrong (often private/internal) IP address that the other side can\u2019t route to. Confirm the RTP port range is open both inbound and outbound on every device in the path.'},
  noaudio: {noaudio:true, oneway:undefined, degraded:false, forcedNote:'A fault was injected on this media stream: no RTP arriving at all, using the “Inject fault” control.',
    fix:'Since signaling succeeded but zero RTP arrived, this is almost always a media-path problem, not a signaling one. Check that the RTP/UDP port range used by both endpoints is open in both directions on every firewall and NAT device between them, confirm the SBC or PBX is actually anchoring/relaying media if it\u2019s supposed to, and check for a misconfigured media-bypass rule that\u2019s dropping packets instead of relaying them.'},
  degraded: {degraded:true, noaudio:false, oneway:undefined, forcedNote:'A fault was injected on this media stream: packet loss and jitter, using the “Inject fault” control.',
    fix:'Check the network path for congestion or an undersized link at busy times — this is classic evidence of insufficient bandwidth or missing QoS/traffic prioritization for voice (RTP) traffic. Confirm voice traffic is being marked and prioritized correctly (e.g. DSCP EF/46) end to end, check for a wireless or VPN hop introducing loss, and rule out CPU-starved endpoints or software phones competing for resources.'},
  nattraversal: {oneway:'B>A', noaudio:false, degraded:false, forcedNote:'A NAT traversal fault was injected: the SDP advertises an address the far end cannot actually reach.',
    fix:'This is a classic NAT/SDP mismatch: one side\u2019s SDP is advertising its private/internal IP address instead of its public-facing one, so the other side sends RTP to an address that doesn\u2019t exist from its perspective. Check whether the endpoint behind NAT has a working STUN configuration to learn and advertise its public address, confirm the SBC/PBX is rewriting SDP correctly if it\u2019s meant to (\u201cmedia proxy\u201d / far-end NAT handling), and check for a SIP ALG on a router silently rewriting SDP incorrectly \u2014 disabling SIP ALG on consumer/small-business routers resolves this surprisingly often.'},
  symmetricnat: {noaudio:true, oneway:undefined, degraded:false, forcedNote:'A symmetric NAT fault was injected: the endpoint\u2019s NAT assigns a different public port to every destination it talks to, so the port learned via STUN doesn\u2019t match the port media actually arrives from.',
    fix:'Symmetric NAT breaks the assumption behind simple STUN-based address discovery: because the NAT maps a different external port for every destination, the address a STUN server reports is only valid for talking to that STUN server — not for any other peer. Host and server-reflexive ICE candidates will both fail connectivity checks in this situation. The reliable fix is a relay (TURN) candidate: since traffic to and from the TURN server always uses the same mapping, media can flow through the relay even though a direct path can\u2019t be established. Confirm a TURN server is configured and reachable, and that ICE is actually including relay candidates in the offer, not just host/srflx ones.'}
};
function effectiveMediaStep(step){
  if(faultMode==='none' || step.kind!=='media') return step;
  const ov = FAULT_OVERRIDES[faultMode];
  if(!ov) return step;
  return Object.assign({}, step, ov);
}

/* =========================================================
   RAW MESSAGE BUILDER
========================================================= */
function userOf(id){ return id==='F' ? 'conference' : ('user'+id); }
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return Math.abs(h); }

/* =========================================================
   SDP BODY FORMATTER — turns the compact authored sdp{c,m,codecs}
   shape into a complete, syntactically correct SDP body (v=/o=/
   s=/t=/proper a=rtpmap: PT lines), shared by the SDP tab and
   the raw SIP packet view so both stay consistent.
========================================================= */
function parseCodecEntry(entry){
  const m = entry.match(/^(.*?)\s*\((\d+)\)\s*(?:—\s*(.*))?$/);
  if(!m) return {pt:null, codec:entry, annotation:null};
  return {codec:m[1].trim(), pt:m[2], annotation:(m[3]||'').trim()||null};
}
function formatSdpBody(step, originId){
  if(!step.sdp) return {body:'', annotations:[]};
  const ep = ENDPOINTS[originId] || {ip:'0.0.0.0'};
  const lines = [];
  const annotations = [];
  if(step.sdp.raw){
    step.sdp.raw.forEach(l=>lines.push(l));
  } else if(step.sdp.c || step.sdp.m || (step.sdp.codecs && step.sdp.codecs.length)){
    lines.push('v=0');
    lines.push('o=- ' + (hashStr((originId||'x')+(step.callId||'sess')).toString().slice(0,10)) + ' 1 IN IP4 ' + ep.ip);
    lines.push('s=SIP Call');
    if(step.sdp.c) lines.push('c='+step.sdp.c);
    lines.push('t=0 0');
    if(step.sdp.m) lines.push('m='+step.sdp.m);
    (step.sdp.codecs||[]).forEach(entry=>{
      if(!entry) return;
      if(entry.indexOf('a=')===0){ lines.push(entry); return; }
      const parsed = parseCodecEntry(entry);
      if(parsed.pt){
        lines.push('a=rtpmap:'+parsed.pt+' '+parsed.codec);
        if(parsed.annotation) annotations.push('Payload type '+parsed.pt+' ('+parsed.codec+'): '+parsed.annotation);
      } else {
        lines.push('a='+entry);
      }
    });
    if(step.sdp.m && /^audio/.test(step.sdp.m)) lines.push('a=ptime:20');
  }
  return { body: lines.join('\n'), annotations };
}
function tagFor(id){ return (hashStr(id+scenarioKey)%9000+1000).toString(); }

function buildRawMessage(step, i){
  const steps = SCENARIOS[scenarioKey].steps;
  const [from,to] = step.dir.split('>');
  const Fep = ENDPOINTS[from];
  const callId = step.callId || sessionCallId;
  const isResp = !!step.code;
  const reqFrom = isResp ? to : from;
  const reqTo = isResp ? from : to;
  const branch = 'z9hG4bK' + hashStr(callId+i).toString(16).slice(0,6);
  const {num, method:cMethod} = cseqInfo(steps, i);
  const scheme = sipScheme();
  const transportTag = transportMode.toUpperCase();

  const lines = [];
  if(isResp){ lines.push(`SIP/2.0 ${step.code} ${step.method.replace(/^\d+\s*/,'')}`); }
  else { lines.push(`${step.method==='RTP Event'?'INFO':step.method} ${scheme}:${userOf(reqTo)}@domain.com SIP/2.0`); }
  lines.push(`Via: SIP/2.0/${transportTag} ${Fep.ip}:${portForEndpoint(from)};branch=${branch}`);
  if(!isResp) lines.push('Max-Forwards: 70');
  lines.push(`From: <${scheme}:${userOf(reqFrom)}@domain.com>;tag=${tagFor(reqFrom)}`);
  const includeToTag = isResp || !step.firstRequest;
  lines.push(`To: <${scheme}:${userOf(reqTo)}@domain.com>${includeToTag ? ';tag='+tagFor(reqTo) : ''}`);
  lines.push(`Call-ID: ${callId}`);
  lines.push(`CSeq: ${num} ${cMethod||step.method}`);
  lines.push(`Contact: <${scheme}:${userOf(from)}@${Fep.ip}:${portForEndpoint(from)}>`);
  if(step.extraHeaders) step.extraHeaders.forEach(h=>lines.push(h));
  if(step.sdp && (step.sdp.c || step.sdp.m || step.sdp.raw || (step.sdp.codecs&&step.sdp.codecs.length))){
    lines.push('Content-Type: application/sdp');
    const body = formatSdpBody(step, from).body;
    lines.push(`Content-Length: ${body.length}`);
    lines.push('');
    lines.push(body);
  } else if(step.body){
    lines.push(`Content-Type: ${step.contentType||'text/plain'}`);
    lines.push(`Content-Length: ${step.body.length}`);
    lines.push('');
    lines.push(step.body);
  } else {
    lines.push('Content-Length: 0');
  }
  return lines.join('\n');
}

/* =========================================================
   INSPECTOR
========================================================= */
let currentRawSip = '';
let currentSdpText = '';
function copyText(which){
  const text = which==='sip' ? currentRawSip : currentSdpText;
  if(!text) return;
  const btn = document.getElementById(which==='sip'?'copySipBtn':'copySdpBtn');
  const done = ()=>{ if(btn){ const orig = which==='sip'?'⧉ Copy SIP':'⧉ Copy SDP'; btn.textContent='✓ Copied'; btn.classList.add('copied'); setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); }, 1400); } };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(done);
  } else { done(); }
}
function renderActiveTab(){
  Array.from(inspTabs.querySelectorAll('.itab')).forEach(b=>b.classList.toggle('active', b.dataset.tab===activeTab));
  Array.from(inspBody.querySelectorAll('.itab-panel')).forEach(p=>p.classList.toggle('active', p.id==='panel-'+activeTab));
}
function buildTrailHtml(steps, i){
  const trail = transactionTrail(steps, i).slice(-7);
  const state = dialogStateAt(steps, i);
  const stateCls = state==='FAILED' ? 'failed' : (state==='ESTABLISHED'||state==='TERMINATED'||state==='CANCELLED') ? '' : 'pending';
  let html = '<div class="trail">';
  if(transactionTrail(steps,i).length>7) html += '<span class="seg">…</span><span class="arrow">→</span>';
  trail.forEach((lbl,idx)=>{
    html += '<span class="seg">'+lbl+'</span>';
    if(idx<trail.length-1) html += '<span class="arrow">→</span>';
  });
  html += '<span class="arrow">→</span><span class="state '+stateCls+'">'+state+'</span></div>';
  return html;
}
function buildDebugTab(step, i){
  const steps = SCENARIOS[scenarioKey].steps;
  let html = '';

  const t = timingInfo(i);
  if(t){
    const fromPrevTone = delayTone(t.fromPrev);
    html += '<div class="timing-grid">';
    html += '<div class="timing-cell"><div class="label">Call elapsed</div><div class="val">t+'+fmtMs(t.elapsed)+'</div></div>';
    html += '<div class="timing-cell"><div class="label">Since previous packet</div><div class="val '+fromPrevTone.cls+'">'+fmtMs(t.fromPrev)+'</div></div>';
    html += '<div class="timing-cell"><div class="label">Delay assessment</div><div class="val '+fromPrevTone.cls+'">'+fromPrevTone.word+'</div></div>';
    html += '<div class="timing-cell"><div class="label">To next packet</div><div class="val">'+(t.hasNext ? fmtMs(t.toNext) : '—')+'</div></div>';
    html += '</div>';
    html += '<div class="timing-note">Timing reflects this playthrough’s pacing at '+speed+'× speed, not a real network capture.</div>';
  } else {
    html += '<div class="timing-note">This packet has not been played yet — timing appears once it fires.</div>';
  }

  html += '<div class="field-list" style="margin-top:14px;"><div class="fline"><span class="k">Expected next:</span> <span class="v">'+expectedNextFor(steps, i)+'</span></div></div>';

  const issue = firstIssueIndex(steps);
  if(faultMode!=='none'){
    html += '<div class="fixout" style="border-color:var(--media);margin-top:0;margin-bottom:12px;"><div class="cw">🧪 Media fault injection active</div>Media steps in this playthrough are being overridden by the “Inject fault on media” control, regardless of how this scenario was originally authored.</div>';
  }
  if(signalFaultMode!=='none'){
    html += '<div class="fixout" style="border-color:var(--teardown);margin-top:0;margin-bottom:12px;"><div class="cw">🧪 Signaling fault injection active</div>This playthrough’s successful outcome has been replaced by the “Inject fault on signaling” control — the call fails before ever reaching media, regardless of how this scenario was originally authored.</div>';
  }
  if(issue.index>=0){
    const failStep = steps[issue.index];
    const effFail = effectiveMediaStep(failStep);
    const isHere = issue.index===i;
    const isHard = issue.severity==='hard';
    const heading = isHere
      ? (isHard ? '⚠ First issue in this call' : '⚠ Quality issue detected (no hard failure)')
      : (isHard ? '⚠ First issue detected at step #'+(issue.index+1) : '⚠ Quality issue detected at step #'+(issue.index+1)+' (no hard failure)');
    html += '<div class="rootcause" style="border-color:'+(isHard?'var(--teardown-dim)':'var(--media-dim)')+'"><div class="cw" style="color:'+(isHard?'var(--teardown)':'var(--media)')+'">'+heading+'</div>';
    if(!isHere){
      html += '<div style="font-size:12.5px;color:var(--text);margin-bottom:6px;">'+displayLabel(failStep)+'</div>';
      html += '<button class="jump" onclick="selectStep('+issue.index+');scrollToStep('+issue.index+');">Jump to it →</button>';
    } else if(effFail.rootCause){
      html += '<div class="chain">';
      effFail.rootCause.forEach((link,idx)=>{
        html += '<div class="link"><span class="num">'+(idx+1)+'</span><span>'+link+'</span></div>';
      });
      html += '</div>';
    } else if(effFail.forcedNote){
      html += '<div class="chain"><div class="link"><span class="num">1</span><span>'+effFail.forcedNote+'</span></div></div>';
    } else if(!isHard){
      html += '<div class="chain"><div class="link"><span class="num">1</span><span>Media quality degraded (packet loss / jitter) partway through the call, without a hard SIP failure.</span></div></div>';
    }
    if(!isHard){
      html += '<div style="font-size:11.5px;color:var(--muted);margin-top:8px;">The call itself still completed — this is a quality issue, not a failed transaction.</div>';
    }
    html += '</div>';
  } else {
    html += '<div class="callout" style="border-color:var(--ok);margin-top:12px;"><div class="cw">Outcome</div>No failure detected in this scenario — every transaction completed as expected.</div>';
  }
  return html;
}

function showInspector(step, i){
  msgTag.style.display = 'inline-block';
  msgTag.style.color = 'var(--bg)';
  inspTabs.style.display = 'flex';
  const steps = SCENARIOS[scenarioKey].steps;
  currentRawSip = '';
  currentSdpText = '';

  let overview = '', sip = '', sdp = '', debug = buildDebugTab(step, i);

  if(step.kind==='media'){
    msgTag.textContent = step.noaudio ? 'NO RTP' : 'RTP / RTCP';
    msgTag.style.background = step.noaudio ? 'var(--teardown)' : (step.held ? 'var(--dim)' : 'var(--media)');
    overview = `<div class="callout" style="border-color:${step.noaudio?'var(--teardown)':'var(--sig)'}"><div class="cw">What's happening</div>${plainFor(step)}</div>`;
    overview += buildTrailHtml(steps, i);
    overview += `<div class="field-list">`;
    overview += `<div class="fline"><span class="k">Stream:</span> <span class="v">${step.label}</span></div>`;
    overview += `<div class="fline"><span class="k">Transport:</span> <span class="v">RTP/AVP over UDP, RTCP on the adjacent odd port</span></div>`;
    if(step.pairs) overview += `<div class="fline"><span class="k">Legs:</span> <span class="v">${step.pairs.map(p=>ENDPOINTS[p[0]].label+' ⇄ '+ENDPOINTS[p[1]].label).join(', ')}</span></div>`;
    if(step.oneway) overview += `<div class="fline"><span class="k">Working direction:</span> <span class="v">${step.oneway.replace('>',' → ')} only</span></div>`;
    overview += `</div>`;
    if(step.forcedNote) overview += `<div class="fixout"><div class="cw">🧪 Fault injection active</div>${step.forcedNote}</div>`;
    if(step.note) overview += `<div class="callout" style="border-color:var(--dim);margin-top:10px;"><div class="cw">Technical note</div>${step.note}</div>`;
    if(step.fix) overview += `<div class="fixout"><div class="cw">Suggested fix</div>${step.fix}</div>`;
    overview += `<div class="stat-row" id="statRow"></div>`;
    sip = `<div class="empty">This is an RTP/RTCP media stream, not a discrete SIP message — see the Overview tab.</div>`;
    sdp = `<div class="empty">No SDP body on a media stream itself — see the SDP tab on the INVITE/200 OK that negotiated it.</div>`;
  } else if(step.kind==='wait'){
    msgTag.textContent = '⏱ Wait';
    msgTag.style.background = 'var(--muted)';
    overview = `<div class="callout" style="border-color:var(--muted)"><div class="cw">What's happening</div>${plainFor(step)}</div>`;
    overview += buildTrailHtml(steps, i);
    if(step.note) overview += `<div class="field-list"><div class="fline" style="color:var(--muted)">${step.note}</div></div>`;
    sip = `<div class="empty">No SIP message is sent while waiting.</div>`;
    sdp = `<div class="empty">No SDP on a wait period.</div>`;
  } else {
    const color = tone(step);
    msgTag.style.background = color;
    msgTag.textContent = displayLabel(step) + (hasSdpBody(step) ? ' · SDP' : '');

    overview = `<div class="callout" style="border-color:${color}"><div class="cw">What's happening</div>${plainFor(step)}</div>`;
    overview += buildTrailHtml(steps, i);
    overview += `<div class="field-list">`;
    const [from,to] = step.dir.split('>');
    overview += from===to
      ? `<div class="fline"><span class="k">Origin:</span> <span class="v">Generated internally at ${ENDPOINTS[from].label}</span></div>`
      : `<div class="fline"><span class="k">Direction:</span> <span class="v">${ENDPOINTS[from].label} → ${ENDPOINTS[to].label}</span></div>`;
    if(step.direct) overview += `<div class="fline"><span class="k">Routing:</span> <span class="v">Direct, in-dialog (bypasses proxy signaling path)</span></div>`;
    if(!step.rtpEvent && !step.rawPacket){
      const {num,method} = cseqInfo(steps, i);
      overview += `<div class="fline"><span class="k">CSeq:</span> <span class="v">${num} ${method||step.method}</span></div>`;
    }
    overview += `</div>`;
    if(step.note) overview += `<div class="callout" style="border-color:var(--dim);margin-top:10px;"><div class="cw">Technical note</div>${step.note}</div>`;
    if(step.fix) overview += `<div class="fixout"><div class="cw">Suggested fix</div>${step.fix}</div>`;

    if(step.rtpEvent || step.rawPacket){
      const packetText = step.rtpPacket || step.rawPacketText || '';
      currentRawSip = packetText;
      sip = `<div class="raw-pre">${packetText}</div><div class="copy-row"><button class="mini-btn" id="copySipBtn" onclick="copyText('sip')">⧉ Copy SIP</button></div>`;
    } else {
      const raw = buildRawMessage(step, i);
      currentRawSip = raw;
      sip = `<div class="raw-pre">${raw}</div><div class="copy-row"><button class="mini-btn" id="copySipBtn" onclick="copyText('sip')">⧉ Copy SIP</button></div>`;
    }

    if(hasSdpBody(step)){
      const [sdpFrom] = step.dir.split('>');
      const {body, annotations} = formatSdpBody(step, sdpFrom);
      currentSdpText = body;
      sdp = `<div class="sdp-block" style="margin-top:0;">${body.split('\n').join('<br>')}</div>`;
      if(annotations.length) sdp += `<div class="field-list" style="margin-top:10px;">${annotations.map(a=>'<div class="fline">'+a+'</div>').join('')}</div>`;
      sdp += `<div class="copy-row"><button class="mini-btn" id="copySdpBtn" onclick="copyText('sdp')">⧉ Copy SDP</button></div>`;
    } else {
      sdp = `<div class="empty">This message does not carry an SDP body.</div>`;
    }
  }

  inspBody.innerHTML =
    `<div class="itab-panel" id="panel-overview">${overview}</div>` +
    `<div class="itab-panel" id="panel-sip">${sip}</div>` +
    `<div class="itab-panel" id="panel-sdp">${sdp}</div>` +
    `<div class="itab-panel" id="panel-debug">${debug}</div>`;
  renderActiveTab();
}

/* =========================================================
   STEP SELECTION (diagram click ↔ log click ↔ inspector)
========================================================= */
let logRowsByIndex = {};
function selectStep(i){
  const raw = SCENARIOS[scenarioKey].steps[i];
  if(!raw) return;
  const step = effectiveMediaStep(raw);
  showInspector(step, i);
  highlightLogRow(i);
  lastSelectedStep = i;
}
function highlightLogRow(i){
  Array.from(logBody.children).forEach(c=>c.classList.remove('active'));
  const row = logRowsByIndex[i];
  if(row){ row.classList.add('active'); row.scrollIntoView({block:'nearest', behavior:'smooth'}); }
}

/* =========================================================
   CAPTURE LOG
========================================================= */
function logStep(step, i){
  const t = clockVal.textContent;
  const color = tone(step);
  const labelTxt = displayLabel(step) + (hasSdpBody(step) ? ' <span class="sdp-chip">SDP</span>' : '');
  const dirTxt = step.kind==='media'
    ? (step.pairs.length>1 ? 'multi-leg' : step.pairs[0][0]+' ⇄ '+step.pairs[0][1])
    : step.kind==='wait' ? step.at+' (wait)'
    : step.dir.split('>')[0]===step.dir.split('>')[1] ? step.dir.split('>')[0]+' (internal)'
    : step.dir.replace('>',' → ');

  logEntries.push({t,i});
  const row = document.createElement('div');
  row.className = 'log-row active';
  row.innerHTML = `<div class="log-row-main"><span class="t">${t}</span><span class="no">#${i+1}</span><span style="color:${color};font-weight:600;">${labelTxt}</span><span class="dir">${dirTxt}</span></div><div class="log-row-sub">${truncate(plainFor(step),96)}</div>`;
  row.onclick = ()=>{ selectStep(i); scrollToStep(i); };
  logRowsByIndex[i] = row;
  Array.from(logBody.children).forEach(c=>c.classList.remove('active'));
  logBody.appendChild(row);
  logBody.scrollTop = logBody.scrollHeight;
  logCount.textContent = `${logEntries.length} packet${logEntries.length===1?'':'s'}`;
}

/* =========================================================
   THEME
========================================================= */
function applyTheme(){
  if(theme==='light'){
    document.documentElement.setAttribute('data-theme','light');
    themeBtn.textContent = '🌙';
    themeBtn.title = 'Switch to dark theme';
    themeBtn.setAttribute('aria-label','Switch to dark theme');
  } else {
    document.documentElement.removeAttribute('data-theme');
    themeBtn.textContent = '☀️';
    themeBtn.title = 'Switch to light theme';
    themeBtn.setAttribute('aria-label','Switch to light theme');
  }
}

/* =========================================================
   INIT
========================================================= */
/* =========================================================
   DRAG-TO-RESIZE — full-width/height handles on the box
   borders, not just a native corner grip.
========================================================= */
function makeVerticalResizer(handleEl, targetEl, opts){
  opts = opts || {};
  const min = opts.min || 150;
  const max = opts.max || Math.round(window.innerHeight*0.85);
  let startY = 0, startH = 0, dragging = false;
  function onMove(e){
    if(!dragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const newH = Math.min(max, Math.max(min, startH + (clientY - startY)));
    targetEl.style.height = newH + 'px';
    e.preventDefault();
  }
  function onUp(){
    dragging = false;
    handleEl.classList.remove('dragging');
    document.body.classList.remove('resizing-v');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  }
  function onDown(e){
    dragging = true;
    handleEl.classList.add('dragging');
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startH = targetEl.getBoundingClientRect().height;
    document.body.classList.add('resizing-v');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('touchend', onUp);
    e.preventDefault();
  }
  handleEl.addEventListener('mousedown', onDown);
  handleEl.addEventListener('touchstart', onDown, {passive:false});
}
function makeColumnSplitter(handleEl, containerEl, opts){
  opts = opts || {};
  const minPct = opts.minPct || 30;
  const maxPct = opts.maxPct || 75;
  let dragging = false;
  function onMove(e){
    if(!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = containerEl.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.min(maxPct, Math.max(minPct, pct));
    containerEl.style.gridTemplateColumns = pct.toFixed(2) + '% 10px 1fr';
    e.preventDefault();
  }
  function onUp(){
    dragging = false;
    handleEl.classList.remove('dragging');
    document.body.classList.remove('resizing-h');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  }
  function onDown(e){
    if(window.innerWidth < 900) return;
    dragging = true;
    handleEl.classList.add('dragging');
    document.body.classList.add('resizing-h');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('touchend', onUp);
    e.preventDefault();
  }
  handleEl.addEventListener('mousedown', onDown);
  handleEl.addEventListener('touchstart', onDown, {passive:false});
}

function getCbParams(){
  const ctBtn = document.querySelector('.cb-btn[data-group="callType"].active');
  const cdBtn = document.querySelector('.cb-btn[data-group="direction"].active');
  const trBtn = document.querySelector('.cb-btn[data-group="transport"].active');
  return {
    name: document.getElementById('cbName').value.trim(),
    callType: ctBtn ? ctBtn.dataset.value : 'internal',
    direction: cdBtn ? cdBtn.dataset.value : 'outbound',
    transport: trBtn ? trBtn.dataset.value : 'udp',
    numPbx: Number(document.getElementById('cbPbxCount').value),
    firewall: {
      enabled: document.getElementById('cbFirewallEnabled').checked,
      position: document.getElementById('cbFirewallPosition').value,
      behavior: document.getElementById('cbFirewallBehavior').value
    },
    codec: document.getElementById('cbCodec').value,
    outcome: document.getElementById('cbOutcome').value
  };
}
function updateCbPreview(){
  const params = getCbParams();
  const endpoints = buildCustomTopology(params);
  const chain = endpoints.map(id => (ENDPOINTS[id]&&ENDPOINTS[id].icon?ENDPOINTS[id].icon+' ':'') + ((ENDPOINTS[id]&&ENDPOINTS[id].label)||id)).join('  →  ');
  const outcomeSelect = document.getElementById('cbOutcome');
  const outcomeText = outcomeSelect.options[outcomeSelect.selectedIndex].textContent;
  const preview = document.getElementById('cbPreview');
  preview.innerHTML = '<div class="cw">Preview</div>' + chain +
    '<br><span style="color:var(--muted);font-size:11px;">' + outcomeText + ' · ' + params.direction + ' · ' + params.transport.toUpperCase() + '</span>';
}
function openCustomBuilder(){
  document.getElementById('mainView').style.display = 'none';
  const cv = document.getElementById('compareView');
  if(cv) cv.style.display = 'none';
  document.getElementById('customBuilderView').style.display = 'block';
  updateCbPreview();
  window.scrollTo({top:0, behavior:'smooth'});
}
function closeCustomBuilder(){
  document.getElementById('customBuilderView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';
}

/* =========================================================
   COMPARE MODE — two static, non-animated summaries side by side
   Deliberately independent of the live playback engine (stepIndex,
   playing, svg, layout) so it cannot affect single-simulation state.
========================================================= */
const COMPARE_FAULT_LABELS = {
  oneway:'One-way audio', noaudio:'No audio (RTP blackhole)', degraded:'Packet loss / jitter',
  nattraversal:'NAT traversal issue', symmetricnat:'Symmetric NAT'
};
function compareEligibleScenarios(catId){
  return scenariosInCategory(catId).filter(k=>{
    const t = SCENARIO_TEMPLATES[k];
    return !t.isExplorer && !t.isCustom;
  });
}
function populateCompareCategorySelect(selectEl){
  selectEl.innerHTML = '';
  CATEGORIES.forEach(c=>{
    if(c.id==='custom') return;
    const n = compareEligibleScenarios(c.id).length;
    if(n===0) return;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (CATEGORY_ICON[c.id]||'') + ' ' + c.label;
    selectEl.appendChild(opt);
  });
}
function populateCompareScenarioSelect(selectEl, catId){
  selectEl.innerHTML = '';
  compareEligibleScenarios(catId).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = SCENARIO_TEMPLATES[key].name;
    selectEl.appendChild(opt);
  });
}
function populateCompareFaultSelect(selectEl){
  selectEl.innerHTML = '';
  const noneOpt = document.createElement('option');
  noneOpt.value = 'none'; noneOpt.textContent = 'No fault — play normally';
  selectEl.appendChild(noneOpt);
  const mediaGroup = document.createElement('optgroup');
  mediaGroup.label = 'Media faults';
  Object.keys(FAULT_OVERRIDES).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = 'media:'+key;
    opt.textContent = COMPARE_FAULT_LABELS[key] || key;
    mediaGroup.appendChild(opt);
  });
  selectEl.appendChild(mediaGroup);
  const signalGroup = document.createElement('optgroup');
  signalGroup.label = 'Signaling faults';
  Object.keys(SIGNAL_FAULTS).forEach(key=>{
    const opt = document.createElement('option');
    opt.value = 'signal:'+key;
    opt.textContent = SIGNAL_FAULTS[key].method;
    signalGroup.appendChild(opt);
  });
  selectEl.appendChild(signalGroup);
}
function renderComparisonSide(prefix){
  const scenarioSel = document.getElementById('cmpScenario'+prefix);
  const faultSel = document.getElementById('cmpFault'+prefix);
  const panel = document.getElementById('cmpPanel'+prefix);
  if(!scenarioSel || !panel) return;
  const key = scenarioSel.value;
  const tpl = SCENARIO_TEMPLATES[key];
  if(!tpl){ panel.innerHTML = '<div class="cmp-empty">Pick a simulation to preview it here.</div>'; return; }

  let steps = tpl.steps.slice();
  const faultVal = faultSel.value;
  if(faultVal.indexOf('media:')===0){
    const fk = faultVal.slice(6);
    const ov = FAULT_OVERRIDES[fk];
    if(ov) steps = steps.map(s => s.kind==='media' ? Object.assign({}, s, ov) : s);
  } else if(faultVal.indexOf('signal:')===0){
    const fk = faultVal.slice(7);
    steps = applySignalingFault(steps, fk);
  }

  const issue = firstIssueIndex(steps);
  const badgeHtml = issue.severity==='hard' ? '<span class="cmp-badge fail">FAIL</span>'
    : issue.severity==='soft' ? '<span class="cmp-badge warn">PASS ⚠</span>'
    : '<span class="cmp-badge pass">PASS</span>';

  let html = '<div class="cmp-summary"><span>'+tpl.endpoints.length+' endpoints · '+steps.length+' steps</span>'+badgeHtml+'</div>';
  steps.forEach(s=>{
    if(s.kind==='signal'){
      const label = displayLabel(s);
      const color = tone(s);
      const dirTxt = s.dir.replace('>',' → ');
      html += '<div class="cmp-step-row"><span class="cmp-step-dir">'+dirTxt+'</span><span class="cmp-step-method" style="color:'+color+'">'+label+'</span></div>';
      if(s.plain) html += '<div class="cmp-step-row" style="padding-top:0;"><span class="cmp-step-dir"></span><span class="cmp-step-note">'+s.plain+'</span></div>';
    } else if(s.kind==='media'){
      const tag = s.noaudio ? ' — no audio' : s.oneway ? ' — one-way' : s.degraded ? ' — degraded' : '';
      html += '<div class="cmp-step-row"><span class="cmp-step-dir">media</span><span class="cmp-step-method" style="color:var(--media)">'+(s.label||'RTP')+tag+'</span></div>';
    } else if(s.kind==='wait'){
      html += '<div class="cmp-step-row"><span class="cmp-step-dir">wait</span><span class="cmp-step-note">'+s.label+'</span></div>';
    }
  });
  panel.innerHTML = html;
}
function initCompareSide(prefix, defaultCat, defaultScenario){
  const catSel = document.getElementById('cmpCategory'+prefix);
  const scenSel = document.getElementById('cmpScenario'+prefix);
  const faultSel = document.getElementById('cmpFault'+prefix);
  populateCompareCategorySelect(catSel);
  catSel.value = defaultCat;
  populateCompareScenarioSelect(scenSel, defaultCat);
  scenSel.value = defaultScenario;
  populateCompareFaultSelect(faultSel);
  catSel.onchange = ()=>{
    populateCompareScenarioSelect(scenSel, catSel.value);
    renderComparisonSide(prefix);
  };
  scenSel.onchange = ()=> renderComparisonSide(prefix);
  faultSel.onchange = ()=> renderComparisonSide(prefix);
  renderComparisonSide(prefix);
}
function openCompareView(){
  document.getElementById('mainView').style.display = 'none';
  document.getElementById('customBuilderView').style.display = 'none';
  document.getElementById('compareView').style.display = 'block';
  initCompareSide('A', 'transfer', 'blindtransfer');
  initCompareSide('B', 'transfer', 'attransfer');
  window.scrollTo({top:0, behavior:'smooth'});
}
function closeCompareView(){
  document.getElementById('compareView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';
}
function init(){
  applyTheme();
  populateCodeSelect();
  populateSdpSelect();
  populateTimerSelect();
  regenerateRespCode('404');
  regenerateSdpParam('m');
  regenerateTimer('T1');
  rebuildScenario(scenarioKey);
  buildCategorySelect();
  buildScenarioSelect();
  buildSpeedGroup();
  buildCallTypeUI();
  buildCallDirectionUI();
  buildTransportUI();
  updateSelMeta();
  codePicker.style.display = (SCENARIOS[scenarioKey].isExplorer && !SCENARIOS[scenarioKey].isSdpExplorer && !SCENARIOS[scenarioKey].isTimerExplorer) ? 'block' : 'none';
  sdpPicker.style.display = SCENARIOS[scenarioKey].isSdpExplorer ? 'block' : 'none';
  timerPicker.style.display = SCENARIOS[scenarioKey].isTimerExplorer ? 'block' : 'none';
  buildColumns();
  computeLayout();
  resetState();
  restoreFromUrlHash();

  playBtn.onclick = ()=> playing ? pause() : play();
  stopBtn.onclick = stopSim;
  restartBtn.onclick = restartSim;
  themeBtn.onclick = ()=>{ theme = theme==='dark' ? 'light' : 'dark'; applyTheme(); };
  const shareLinkBtn = document.getElementById('shareLinkBtn');
  if(shareLinkBtn) shareLinkBtn.onclick = copyShareableLink;
  const compareBtn = document.getElementById('compareBtn');
  const compareBackBtn = document.getElementById('compareBackBtn');
  if(compareBtn) compareBtn.onclick = openCompareView;
  if(compareBackBtn) compareBackBtn.onclick = closeCompareView;
  codeSelect.onchange = ()=>{ regenerateRespCode(codeSelect.value); switchScenario('respcode'); };
  sdpSelect.onchange = ()=>{ regenerateSdpParam(sdpSelect.value); switchScenario('sdpparam'); };
  timerSelect.onchange = ()=>{ regenerateTimer(timerSelect.value); switchScenario('timersref'); };
  categorySelect.onchange = ()=>{
    categoryKey = categorySelect.value;
    const first = scenariosInCategory(categoryKey)[0];
    switchScenario(first);
  };
  scenarioSelect.onchange = ()=> switchScenario(scenarioSelect.value);
  faultSelect.onchange = ()=>{
    faultMode = faultSelect.value;
    if(lastSelectedStep>=0) selectStep(lastSelectedStep);
    updateFaultStatus();
  };
  signalFaultSelect.onchange = ()=> setSignalFault(signalFaultSelect.value);
  document.getElementById('clearFaultsBtn').onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); clearAllFaults(); };
  document.getElementById('clearFaultsBtn2').onclick = (e)=>{ e.preventDefault(); clearAllFaults(); };
  updateFaultStatus();
  exportLogBtn.onclick = exportCaptureLog;
  Array.from(document.querySelectorAll('.ct-btn')).forEach(btn=>{
    btn.onclick = ()=> setCallType(btn.dataset.type);
  });
  Array.from(document.querySelectorAll('.cd-btn')).forEach(btn=>{
    btn.onclick = ()=> setCallDirection(btn.dataset.dir);
  });
  Array.from(document.querySelectorAll('.tr-btn')).forEach(btn=>{
    btn.onclick = ()=> setTransport(btn.dataset.transport);
  });
  scenarioSearch.addEventListener('input', ()=> renderSearchResults(scenarioSearch.value));
  scenarioSearch.addEventListener('focus', ()=>{ if(scenarioSearch.value.trim()) renderSearchResults(scenarioSearch.value); });
  scenarioSearch.addEventListener('blur', ()=>{ setTimeout(()=>{ searchResults.style.display='none'; }, 150); });
  scenarioSearch.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){ scenarioSearch.value=''; searchResults.style.display='none'; scenarioSearch.blur(); }
    else if(e.key==='Enter'){
      const results = runSearch(scenarioSearch.value);
      if(results.length){
        switchScenario(results[0].key);
        scenarioSearch.value = '';
        searchResults.style.display = 'none';
      }
      e.preventDefault();
    }
  });
  resetAllBtn.onclick = resetAllOptions;
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const appShell = document.getElementById('appShell');
  if (sidebarToggleBtn && appShell) {
    sidebarToggleBtn.onclick = () => appShell.classList.toggle('sidebar-collapsed');
  }
  Array.from(document.querySelectorAll('.rail-btn')).forEach(btn=>{
    btn.onclick = () => {
      appShell.classList.remove('sidebar-collapsed');
      const targetId = btn.dataset.focus;
      const target = document.getElementById(targetId);
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (typeof target.focus === 'function') target.focus({ preventScroll: true });
      }
    };
  });
  document.getElementById('tourTriggerBtn').onclick = startTour;
  document.getElementById('tourSkipBtn').onclick = endTour;
  document.getElementById('tourNextBtn').onclick = nextTourStep;
  document.getElementById('tourBackBtn').onclick = prevTourStep;
  window.addEventListener('resize', () => {
    if (document.getElementById('tourOverlay').style.display !== 'none') positionTourStep(tourStepIndex);
  });
  try {
    if (!localStorage.getItem('sipSimTourSeen')) {
      setTimeout(startTour, 1200);
    }
  } catch(e) {}
  Array.from(inspTabs.querySelectorAll('.itab')).forEach(btn=>{
    btn.onclick = ()=>{ activeTab = btn.dataset.tab; renderActiveTab(); };
  });

  makeVerticalResizer(document.getElementById('resizeDiagram'), scrollArea, {min:200});
  makeVerticalResizer(document.getElementById('resizeInspector'), inspBody, {min:160});
  makeVerticalResizer(document.getElementById('resizeLog'), logBody, {min:100});
  makeColumnSplitter(document.getElementById('colSplitter'), document.getElementById('mainGrid'));

  /* ---------- Custom builder wiring ---------- */
  document.getElementById('openBuilderBtn').onclick = openCustomBuilder;
  document.getElementById('cbBackBtn').onclick = closeCustomBuilder;
  document.getElementById('cbFirewallEnabled').onchange = (e)=>{
    document.getElementById('cbFirewallOptions').style.display = e.target.checked ? 'block' : 'none';
    updateCbPreview();
  };
  ['cbPbxCount','cbFirewallPosition','cbFirewallBehavior','cbCodec','cbOutcome'].forEach(id=>{
    document.getElementById(id).onchange = updateCbPreview;
  });
  document.getElementById('cbName').addEventListener('input', updateCbPreview);
  Array.from(document.querySelectorAll('.cb-btn')).forEach(btn=>{
    btn.onclick = ()=>{
      const group = btn.dataset.group;
      Array.from(document.querySelectorAll('.cb-btn[data-group="'+group+'"]')).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      updateCbPreview();
    };
  });
  document.getElementById('cbRunBtn').onclick = ()=>{
    const params = getCbParams();
    runCustomBuilder(params);
    switchScenario('custom');
    closeCustomBuilder();
    window.scrollTo({top:0, behavior:'smooth'});
  };
}
init();

/* =========================================================
   LANDING PAGE — purely additive UI layer.
   Does not call, wrap, or modify any existing engine function.
   The simulator (init() above) already runs normally underneath;
   this only decides whether the landing overlay is shown on top
   of it, and hides itself when the user clicks through.
========================================================= */
(function landingPageInit(){
  const landingView = document.getElementById('landingView');
  if(!landingView) return;

  // A deep-link means the person arrived with explicit intent (a shared
  // scenario/fault/config) — skip the landing page entirely so they land
  // straight on what was shared with them, exactly as before this feature existed.
  if(location.hash && location.hash.length > 1){
    landingView.style.display = 'none';
    return;
  }

  // Reuse the real app logo (already loaded in the topbar) instead of a
  // placeholder — cloning the existing image avoids duplicating its data.
  const logoSlot = document.getElementById('landingLogoMark');
  const sourceLogo = document.getElementById('topbarBrandImg');
  if(logoSlot && sourceLogo){
    const clone = sourceLogo.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.borderRadius = '9px';
    clone.style.objectFit = 'contain';
    logoSlot.textContent = '';
    logoSlot.style.background = 'transparent';
    logoSlot.style.boxShadow = 'none';
    logoSlot.appendChild(clone);
  }

  const bootScreen = document.getElementById('bootScreen');
  const bootLines = document.getElementById('bootLines');
  const bootSkipBtn = document.getElementById('bootSkipBtn');
  const bootProgressFill = document.getElementById('bootProgressFill');
  const bootProgressLabel = document.getElementById('bootProgressLabel');
  const landingContent = document.getElementById('landingContent');

  const BOOT_SEQUENCE = [
    'Initializing protocol analyzer core...',
    'Establishing local endpoint 192.168.1.100:5060...',
    'Mounting scenario library — 63 scenarios / 15 categories...',
    'Starting signaling engine — SIP · SDP · RTP/RTCP...',
    'Arming fault injection modules — 12 fault types...',
    'All systems nominal. Launching interface...'
  ];

  let bootFinished = false;
  function finishBoot(){
    if(bootFinished) return;
    bootFinished = true;
    if(bootScreen) bootScreen.classList.add('hidden');
    if(landingContent) landingContent.classList.add('visible');
  }

  function typeLine(lineEl, textEl, okEl, text, onDone){
    lineEl.classList.add('show');
    textEl.classList.add('typing');
    let i = 0;
    const speed = 14;
    const step = ()=>{
      textEl.textContent = text.slice(0, i);
      i++;
      if(i <= text.length){
        setTimeout(step, speed);
      } else {
        textEl.classList.remove('typing');
        okEl.classList.add('show');
        onDone();
      }
    };
    step();
  }

  function runBootSequence(){
    if(!bootLines){ finishBoot(); return; }
    const total = BOOT_SEQUENCE.length;
    let i = 0;
    function nextLine(){
      if(i >= total){
        setTimeout(finishBoot, 450);
        return;
      }
      const lineEl = document.createElement('div');
      lineEl.className = 'boot-line';
      const prefix = document.createElement('span');
      prefix.className = 'boot-line-prefix';
      prefix.textContent = '>';
      const textEl = document.createElement('span');
      textEl.className = 'boot-line-text';
      const okEl = document.createElement('span');
      okEl.className = 'boot-line-ok';
      okEl.textContent = i === total-1 ? 'READY' : 'OK';
      lineEl.appendChild(prefix);
      lineEl.appendChild(textEl);
      lineEl.appendChild(okEl);
      bootLines.appendChild(lineEl);

      typeLine(lineEl, textEl, okEl, BOOT_SEQUENCE[i], ()=>{
        i++;
        const pct = Math.round((i/total)*100);
        if(bootProgressFill) bootProgressFill.style.width = pct+'%';
        if(bootProgressLabel) bootProgressLabel.textContent = pct+'%';
        setTimeout(nextLine, 180);
      });
    }
    nextLine();
  }

  if(bootSkipBtn) bootSkipBtn.onclick = finishBoot;
  runBootSequence();

  function enterSimulator(){
    landingView.classList.add('launching');
    const mainView = document.getElementById('mainView');
    if(mainView){
      mainView.classList.remove('app-entering');
      // force reflow so the entrance animation reliably restarts
      void mainView.offsetWidth;
      mainView.classList.add('app-entering');
    }
    // The onboarding tour auto-shows ~1.2s after load per its own existing
    // logic, which can elapse while the boot sequence is still playing.
    // Dismiss it via its own existing function (same as its own Skip button)
    // rather than reimplementing anything, so it's marked "seen" correctly.
    if(typeof endTour === 'function'){
      const overlay = document.getElementById('tourOverlay');
      if(overlay && overlay.style.display !== 'none') endTour();
    }
    setTimeout(()=>{ landingView.style.display = 'none'; }, 560);
  }
  const getStartedBtn = document.getElementById('landingGetStartedBtn');
  const getStartedBtn2 = document.getElementById('landingGetStartedBtn2');
  if(getStartedBtn) getStartedBtn.onclick = enterSimulator;
  if(getStartedBtn2) getStartedBtn2.onclick = enterSimulator;
})();
