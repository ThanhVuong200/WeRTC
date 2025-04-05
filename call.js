document.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo các biến và cấu hình
  const roomHash = location.hash.substring(1) || generateRoomId();
  const drone = new ScaleDrone('yiS12Ts5RdNhebyM');
  const roomName = 'observable-' + roomHash;
  const configuration = {
    iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
    }]
  };
  
  let room;
  let pc;
  let localStream;
  let isAlone = true;
  
  // Các phần tử DOM
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  const waitingOverlay = document.getElementById('waitingOverlay');
  const toggleCameraBtn = document.getElementById('toggleCamera');
  const toggleMicrophoneBtn = document.getElementById('toggleMicrophone');
  const hangupBtn = document.getElementById('hangup');
  const copyRoomIdBtn = document.getElementById('copyRoomId');
  const copyTooltip = document.getElementById('copyTooltip');
  const roomIdDisplay = document.getElementById('roomIdDisplay');

  // Hiển thị ID phòng
  roomIdDisplay.textContent = roomHash;

  // Kết nối Scaledrone
  drone.on('open', error => {
    if (error) return console.error('Lỗi kết nối Scaledrone:', error);
    
    room = drone.subscribe(roomName);
    room.on('open', error => {
      if (error) return console.error('Lỗi khi mở phòng:', error);
    });
    
    // Xử lý thành viên trong phòng
    room.on('members', members => {
      const isOfferer = members.length === 2;
      waitingOverlay.classList.toggle('hidden', members.length > 1);
      isAlone = members.length === 1;
      startWebRTC(isOfferer);
    });
    
    room.on('member_join', () => {
      waitingOverlay.classList.add('hidden');
      isAlone = false;
    });
    
    room.on('member_leave', handleRemoteDisconnect);
  });

  // Khởi tạo WebRTC
  function startWebRTC(isOfferer) {
    if (pc) pc.close();
    pc = new RTCPeerConnection(configuration);
    
    // Xử lý ICE candidates
    pc.onicecandidate = event => {
      if (event.candidate) {
        drone.publish({
          room: roomName,
          message: {'candidate': event.candidate}
        });
      }
    };
    
    // Xử lý kết nối video từ xa
    pc.ontrack = event => {
      const stream = event.streams[0];
      if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
        remoteVideo.srcObject = stream;
        remoteVideo.classList.add('active');
        localVideo.classList.add('small');
      }
    };
    
    // Tạo offer nếu là người gọi
    if (isOfferer) {
      pc.onnegotiationneeded = () => {
        pc.createOffer()
          .then(localDescCreated)
          .catch(error => console.error('Lỗi khi tạo offer:', error));
      };
    }
    
    // Khởi tạo media stream
    if (!localStream) {
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
        .then(stream => {
          localStream = stream;
          localVideo.srcObject = stream;
          stream.getTracks().forEach(track => pc.addTrack(track, stream));
        })
        .catch(error => console.error('Lỗi khi truy cập thiết bị media:', error));
    } else {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    
    // Xử lý tin nhắn từ phòng
    room.on('data', (message, client) => {
      if (client.id === drone.clientId) return;
      
      if (message.sdp) {
        pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
          .then(() => {
            if (pc.remoteDescription.type === 'offer') {
              pc.createAnswer()
                .then(localDescCreated)
                .catch(error => console.error('Lỗi khi tạo answer:', error));
            }
          });
      } else if (message.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    });
  }

  // Thiết lập local description
  function localDescCreated(desc) {
    pc.setLocalDescription(desc)
      .then(() => {
        drone.publish({
          room: roomName,
          message: {'sdp': pc.localDescription}
        });
      });
  }

  // Xử lý ngắt kết nối
  function handleRemoteDisconnect() {
    waitingOverlay.classList.remove('hidden');
    isAlone = true;
    remoteVideo.classList.remove('active');
    remoteVideo.srcObject = null;
    localVideo.classList.remove('small');
    
    if (pc) {
      pc.close();
      pc = null;
    }
  }

  // Xử lý các nút điều khiển
  toggleCameraBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleCameraBtn.classList.toggle('disabled', !videoTrack.enabled);
      toggleCameraBtn.innerHTML = videoTrack.enabled ? 
        '<i class="fas fa-video"></i>' : 
        '<i class="fas fa-video-slash"></i>';
    }
  });

  toggleMicrophoneBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleMicrophoneBtn.classList.toggle('disabled', !audioTrack.enabled);
      toggleMicrophoneBtn.innerHTML = audioTrack.enabled ? 
        '<i class="fas fa-microphone"></i>' : 
        '<i class="fas fa-microphone-slash"></i>';
    }
  });

  hangupBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn kết thúc cuộc gọi không?')) {
      if (pc) pc.close();
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      window.location.href = 'index.html';
    }
  });

  copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomHash).then(() => {
      copyTooltip.textContent = 'Đã sao chép!';
      setTimeout(() => copyTooltip.textContent = 'Sao chép', 2000);
    });
  });

  // Xử lý phím tắt
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') toggleMicrophoneBtn.click();
    if (event.key.toLowerCase() === 'v') toggleCameraBtn.click();
  });

  // Cảnh báo khi rời trang
  window.addEventListener('beforeunload', (e) => {
    if (!isAlone) {
      e.returnValue = 'Rời khỏi trang sẽ ngắt kết nối cuộc gọi. Bạn có chắc muốn rời đi?';
      return e.returnValue;
    }
  });

  // Tạo ID phòng ngẫu nhiên
  function generateRoomId() {
    return Array(6).fill()
      .map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62)))
      .join('');
  }
});