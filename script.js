// Generate random room name if needed
if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
const roomHash = location.hash.substring(1);

// TODO: Replace with your own channel ID
const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + roomHash;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;
let localStream;

function onSuccess() {};
function onError(error) {
  console.error(error);
};

drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  room.on('members', members => {
    console.log('MEMBERS', members);
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });

  // Phát hiện khi một thành viên rời khỏi phòng
  room.on('member_leave', member => {
    console.log('Member left:', member);
    handleRemoteDisconnect();
  });
});

function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    };
  }

  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const cameraStatus = document.querySelector('.camera-status');
  const microphoneStatus = document.querySelector('.microphone-status');
  

  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
      remoteVideo.classList.add('active');
      localVideo.classList.add('small');
    }
  };

  // Phát hiện khi kết nối bị ngắt
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
      handleRemoteDisconnect();
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  room.on('data', (message, client) => {
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(onError);
        }
      }, onError);
    } else if (message.candidate) {
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), onSuccess, onError
      );
    }
  });

  // Xử lý các nút điều khiển
  const toggleCameraBtn = document.getElementById('toggleCamera');
  const toggleMicrophoneBtn = document.getElementById('toggleMicrophone');
  const hangupBtn = document.getElementById('hangup');

  toggleCameraBtn.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    toggleCameraBtn.style.backgroundColor = videoTrack.enabled ? '#6a0dad' : '#555';
    cameraStatus.textContent = videoTrack.enabled ? '📷 Camera on' : '📷 Camera off';
  });

  toggleMicrophoneBtn.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    toggleMicrophoneBtn.style.backgroundColor = audioTrack.enabled ? '#6a0dad' : '#555';
    microphoneStatus.textContent = audioTrack.enabled ? '🎤 Micro on' : '🎤 Micro off';
  });

  hangupBtn.addEventListener('click', () => {
    if (pc) {
      pc.close();
      pc = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    window.location.reload(); // Tải lại trang để kết thúc cuộc gọi
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    onError
  );
}

// Hàm xử lý khi remote user ngắt kết nối
function handleRemoteDisconnect() {
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');

  // Ẩn video remote
  remoteVideo.classList.remove('active');
  remoteVideo.srcObject = null;

  // Đưa video local trở lại chính giữa
  localVideo.classList.remove('small');

  // Đóng kết nối WebRTC
  if (pc) {
    pc.close();
    pc = null;
  }

  // Tạo lại kết nối WebRTC để sẵn sàng cho người mới tham gia
  setTimeout(() => {
    room.on('members', members => {
      const isOfferer = members.length === 2;
      if (isOfferer) {
        startWebRTC(true);
      }
    });
  }, 1000);
}