import './style.css';
import firebase from 'firebase/app';
import 'firebase/firestore';
import RTCCall from "./RTCCall";


// Firestore init
import firebaseConfig from "../config.json";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const webcamVideo = document.getElementById("local-video") as HTMLMediaElement;
const remoteVideo = document.getElementById("remote-video") as HTMLMediaElement;
const callIdInput = document.getElementById("call-id-input") as HTMLInputElement;
const createCallButton = document.getElementById("create-call-button") as HTMLButtonElement;
const answerCallButton = document.getElementById("answer-call-button") as HTMLButtonElement;
const hangupCallButton = document.getElementById("hangup-call-button") as HTMLButtonElement;
const status = document.getElementById('status') as HTMLElement;

// Call

let call = initCall();

// Create call
createCallButton.onclick = async () => {
  createCallButton.disabled = true;
  answerCallButton.disabled = true;
  hangupCallButton.disabled = false;
  const callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  callIdInput.value = callDoc.id;

  const offer = await call.startCall({
    onIceCandidate: (candidate: RTCIceCandidate) => {
      candidate && offerCandidates.add(candidate.toJSON());
    }
  });
  await callDoc.set({ offer });

  callDoc.onSnapshot(snapshot => {
    const data = snapshot.data();
    data?.answer && call.resolve(data.answer);
  });
  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        call.addIceCandidate(change.doc.data());
      }
    });
  });
};

answerCallButton.onclick = async () => {
  createCallButton.disabled = true;
  answerCallButton.disabled = true;
  hangupCallButton.disabled = false;
  const callId = callIdInput.value;
  const callDoc = firestore.collection('calls').doc(callId);
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');

  const callData = (await callDoc.get()).data();

  const answer = await call.answerCall({
    offer: {
      type: callData?.offer.type,
      sdp: callData?.offer.sdp
    },
    onIceCandidate: (candidate: RTCIceCandidate) => {
      candidate && answerCandidates.add(candidate.toJSON());
    }
  });

  await callDoc.update({
    answer: {
      sdp: answer.sdp,
      type: answer.type
    }
  });

  offerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        call.addIceCandidate(change.doc.data());
      }
    });
  });

};

hangupCallButton.onclick = () => {
  createCallButton.disabled = false;
  answerCallButton.disabled = false;
  hangupCallButton.disabled = true;
  callIdInput.value = '';
  call.close();
  call = initCall();
};


function initCall() {
  const call = new RTCCall();

  call.onChangeState(() => {
    status.innerText = call.getState();
  });

  call.onReady(() => {
    remoteVideo.srcObject = call.getRemoteStream();
    webcamVideo.srcObject = call.getLocalStream() || new MediaStream();
  });
  return call;
}

