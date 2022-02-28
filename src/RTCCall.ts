const iceConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    }
  ],
  iceCandidatePoolSize: 10
};

type RTCCallState = 'INITIALIZING' | 'READY' | 'CALLING' | 'CONNECTED' | 'CLOSED' | 'FAILED';

async function invokeAsync(func: Function) {
  func && func();
}

export default class RTCCall {
  private peerConnection: RTCPeerConnection;
  private localStream?: MediaStream;
  private remoteStream: MediaStream;

  private state: RTCCallState;

  private listeners: { [name: string]: Function; } = {};

  public constructor() {
    this.state = 'INITIALIZING';
    this.peerConnection = new RTCPeerConnection(iceConfig);
    this.remoteStream = new MediaStream();
    this.init();
  }

  private async init() {
    try {
      // Local - Ask for audio and video
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (!this.localStream) {
        this.setState('FAILED');
        return;
      }

      // Remote - Initialize an empty MediaStream
      this.remoteStream = new MediaStream();

      // Add tracks to the peer connection
      this.localStream.getTracks().forEach((track) => {
        this.localStream && this.peerConnection.addTrack(track, this.localStream);
      });

      this.peerConnection.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
      };
      this.setState('READY');
    } catch (error) {
      this.setState('FAILED');
      console.error(error);
    }
  }

  // Create
  public async startCall(config: { onIceCandidate: Function; }): Promise<RTCSessionDescriptionInit | undefined> {
    if (this.state !== 'READY')
      throw `${this.state}`;

    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
      config.onIceCandidate(event.candidate);
    };

    const offerDescription = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offerDescription);

    if (!offerDescription.sdp || !offerDescription.type) {
      throw "ERROR2";
    }

    const offer: RTCSessionDescriptionInit = {
      sdp: offerDescription.sdp,
      type: offerDescription.type
    };

    this.setState('CALLING');
    return offer;
  }

  public resolve(desc: RTCSessionDescriptionInit) {
    if (!this.peerConnection.currentRemoteDescription) {
      console.log(desc);
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
      this.setState('CONNECTED');
    }
  }

  // Answer
  public async answerCall(config: {
    offer: RTCSessionDescriptionInit,
    onIceCandidate: Function;
  }): Promise<RTCSessionDescriptionInit> {

    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
      config.onIceCandidate(event.candidate);
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(config.offer));
    const answerDescription = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answerDescription);

    this.setState('CONNECTED');
    return answerDescription;
  }

  public addIceCandidate(candidate: RTCIceCandidateInit) {
    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public close() {
    this.peerConnection.close();
  }

  private setState(state: RTCCallState) {
    this.state = state;
    invokeAsync(this.listeners['onChangeState']);
    // Handler listeners
    if (state === 'READY') {
      invokeAsync(this.listeners['onReady']);
    }
  }

  public getState(): RTCCallState {
    return this.state;
  }

  public onReady(func: Function) {
    this.listeners['onReady'] = func;
  }

  public onChangeState(func: Function) {
    this.listeners['onChangeState'] = func;
  }

  public getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream {
    return this.remoteStream;
  }
}