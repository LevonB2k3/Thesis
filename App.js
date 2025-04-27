import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [selectedFile, setSelectedFile] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);

  // ✅ Fetch User-Specific Files
  useEffect(() => {
    if (token) {
      axios
        .get("http://localhost:5001/files", {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => setFiles(response.data))
        .catch((error) => console.error("Error fetching files:", error));
    }
  }, [token]);

  // ✅ Handle File Upload
  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("❌ Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:5001/upload", formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      });

      setMessage(response.data.message);
      setFiles([...files, { id: response.data.file_id, file_name: file.name }]);
    } catch (error) {
      setMessage("❌ Error uploading file.");
    }
  };

  // ✅ Handle File Download
  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await axios.get(`http://localhost:5001/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage(`✅ Download started: ${fileName}`);
    } catch (error) {
      console.error("❌ Error downloading file:", error);
      setMessage("❌ Failed to download file.");
    }
  };

  // ✅ Handle File Deletion
  const handleDelete = async (fileId) => {
    try {
      await axios.delete(`http://localhost:5001/delete/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(files.filter((file) => file.id !== fileId));
      setMessage("✅ File deleted successfully!");
      setSelectedFile(null);
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  // ✅ Handle User Authentication
  const handleRegister = async () => {
    if (!username || !password || !email) {
      setMessage("❌ Please enter username, email, and password.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5001/register", { username, password, email });

      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      setIsAuthenticated(true);
      setMessage("✅ Registered and logged in!");
    } catch (error) {
      setMessage(error.response?.data?.error || "❌ Error during registration.");
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage("❌ Please enter username and password.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5001/login", { username, password });

      localStorage.setItem("token", response.data.token);
      setToken(response.data.token);
      setIsAuthenticated(true);
      setMessage("✅ Login successful!");
    } catch (error) {
      setMessage(error.response?.data?.error || "❌ Account not found. Please register first.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    setIsAuthenticated(false);
    setFiles([]);
    setMessage("Logged out successfully!");
  };

  // ✅ Handle Password Reset
  const handlePasswordReset = async () => {
    if (!resetEmail || !newPassword) {
      setMessage("❌ Please enter your email and a new password.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5001/reset-password", {
        email: resetEmail,
        newPassword,
      });

      setMessage(response.data.message);
    } catch (error) {
      setMessage(error.response?.data?.error || "❌ Error resetting password.");
    }
  };

  return (
    <div className="container">
      <h1>Secure Cloud Storage</h1>

      {!isAuthenticated ? (
        <div className="auth-container">
          <h3>User Authentication</h3>
          <input type="text" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
          <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <button className="btn primary" onClick={handleRegister}>Register</button>
          <button className="btn primary" onClick={handleLogin}>Login</button>
          
          <p className="forgot-password" onClick={() => setShowResetForm(!showResetForm)}>Forgot Password?</p>

          {showResetForm && (
            <div className="reset-password-form">
              <input type="email" placeholder="Enter your email" onChange={(e) => setResetEmail(e.target.value)} />
              <input type="password" placeholder="New Password" onChange={(e) => setNewPassword(e.target.value)} />
              <button className="btn reset" onClick={handlePasswordReset}>Reset Password</button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button className="btn logout" onClick={handleLogout}>Logout</button>

          <h3>Upload a File</h3>
          <input type="file" onChange={handleFileChange} />
          <button className="btn primary" onClick={handleUpload}>Upload File</button>

          <h3>Your Uploaded Files</h3>
          <div className="file-grid">
            {files.map((file) => (
              <div key={file.id} className="file-item">
                <iframe src={`http://localhost:5001/uploads/${file.file_name}`} className="file-preview"></iframe>
                <button className="btn secondary" onClick={() => handleDownload(file.id, file.file_name)}>Download</button>
                <button className="btn delete" onClick={() => handleDelete(file.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p>{message}</p>
    </div>
  );
}

export default App;