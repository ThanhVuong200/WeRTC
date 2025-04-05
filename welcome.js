document.addEventListener('DOMContentLoaded', () => {
  // Lấy các phần tử DOM
  const createRoomBtn = document.getElementById('createRoomBtn');
  const joinRoomToggle = document.getElementById('joinRoomToggle');
  const joinForm = document.getElementById('joinForm');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const roomIdInput = document.getElementById('roomId');
  
  // Hiển thị/ẩn form tham gia phòng
  joinRoomToggle.addEventListener('click', () => {
    joinForm.style.display = joinForm.style.display === 'block' ? 'none' : 'block';
    if (joinForm.style.display === 'block') roomIdInput.focus();
  });
  
  // Tạo phòng mới
  createRoomBtn.addEventListener('click', () => {
    window.location.href = `call.html#${generateRoomId()}`;
  });
  
  // Tham gia phòng hiện có
  joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    
    if (roomId) {
      // Chuyển hướng đến trang cuộc gọi với ID phòng đã nhập
      window.location.href = `call.html#${roomId}`;
    } else {
      alert('Vui lòng nhập mã phòng');
    }
  });
  
  // Xử lý khi nhấn Enter trong ô nhập mã phòng
  roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      joinRoomBtn.click();
    }
  });
  
  // Hàm tạo ID phòng ngẫu nhiên
  function generateRoomId() {
    return Array(6).fill()
      .map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        .charAt(Math.floor(Math.random() * 62)))
      .join('');
  }
}); 