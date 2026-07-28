import React, {
  lazy,
  Suspense,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import HealthChatbot from "./Chatbot";
import Appointments from "./Appointments";
import Prescriptions from "./Prescriptions";
import Notifications from "./Notifications";
import AdminSendNotification from "./AdminSendNotification";
import RecordVersionHistory from "./RecordVersionHistory";
import PatientClinicalProfile from "./PatientClinicalProfile";
import AIReportComparison from "./AIReportComparison";
import PatientHealthTimeline from "./PatientHealthTimeline";
import EmergencyAlertButton from "./EmergencyAlertButton";
import EmergencyAlerts from "./EmergencyAlerts";

const MealPlanner = lazy(() => import("../meal-planner/MealPlanner"));

const getDashboardStorageKey = (role, key) =>
  `careconnect:${role || "guest"}:${key}`;

const Dashboard = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("dashboard");
  const [clinicalProfileTarget, setClinicalProfileTarget] = useState(null);
  const [prescriptionPatientEmail, setPrescriptionPatientEmail] = useState("");
  const [records, setRecords] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // AI Health Tips state
  const [healthTips, setHealthTips] = useState([]);
  const [healthTipsLoading, setHealthTipsLoading] = useState(false);

  // Messaging state
  const [clinicians, setClinicians] = useState([]);
  const [messageRequests, setMessageRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [messagingView, setMessagingView] = useState("browse");
  const conversationScrollRef = useRef(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Profile state
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [editedProfile, setEditedProfile] = useState({
    name: "",
    email: "",
    countryCode: "+91",
    phone: "",
    emergencyCountryCode: "+91",
    emergencyPhone: "",
    age: "",
    bloodType: "",
    address: "",
  });

  const [adminStats, setAdminStats] = useState({});
  const [clinicianRequests, setClinicianRequests] = useState([]);
  const [allClinicians, setAllClinicians] = useState([]);
  const [clinicianSearch, setClinicianSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminView, setAdminView] = useState("dashboard");

  const [clinicianApprovalStatus, setClinicianApprovalStatus] = useState(null);
  const [showApprovalRequestModal, setShowApprovalRequestModal] =
    useState(false);
  const [approvalRequestMessage, setApprovalRequestMessage] = useState("");

  const [adminUsers, setAdminUsers] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [adminConversations, setAdminConversations] = useState([]);
  const [adminSelectedConversation, setAdminSelectedConversation] =
    useState(null);
  const [adminMessages, setAdminMessages] = useState([]);
  const [adminNewMessage, setAdminNewMessage] = useState("");
  const [adminMessagingView, setAdminMessagingView] = useState("users");
  const adminConversationScrollRef = useRef(null);
  const [adminPatientSearch, setAdminPatientSearch] = useState("");
  const [adminPatientStatusFilter, setAdminPatientStatusFilter] =
    useState("all");
  const [adminUserActionModal, setAdminUserActionModal] = useState({
    open: false,
    role: "",
    userId: null,
    userName: "",
    action: "deactivate",
  });

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordDetails, setRecordDetails] = useState(null);

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionRecord, setVersionRecord] = useState(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");

  const countries = [
    { name: "India", code: "+91", maxLength: 10 },
    { name: "USA", code: "+1", maxLength: 10 },
    { name: "UK", code: "+44", maxLength: 10 },
    { name: "Australia", code: "+61", maxLength: 9 },
  ];

  const openVersionHistory = (record) => {
    setVersionRecord(record);
    setShowVersionHistory(true);
  };

  const isPhoneValid = () => {
    const selectedCountry = countries.find(
      (c) => c.code === editedProfile.countryCode,
    );

    if (!selectedCountry) return false;

    return (
      editedProfile.phone &&
      editedProfile.phone.length === selectedCountry.maxLength
    );
  };
  const isEmergencyPhoneValid = () => {
    const selectedCountry = countries.find(
      (c) => c.code === editedProfile.emergencyCountryCode,
    );

    if (!selectedCountry) return false;

    return (
      editedProfile.emergencyPhone &&
      editedProfile.emergencyPhone.length === selectedCountry.maxLength
    );
  };

  const formatMessageDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date);

    const isToday = msgDate.toDateString() === today.toDateString();
    const isYesterday = msgDate.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return msgDate.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (!user?.role) return;

    const savedCurrentView = localStorage.getItem(
      getDashboardStorageKey(user.role, "currentView"),
    );
    const adminHiddenViews = ["appointments", "prescriptions"];

    if (user.role === "admin" && adminHiddenViews.includes(savedCurrentView)) {
      setCurrentView("dashboard");
      localStorage.setItem(
        getDashboardStorageKey(user.role, "currentView"),
        "dashboard",
      );
    } else if (savedCurrentView) {
      setCurrentView(savedCurrentView);
    }

    const savedMessagingView = localStorage.getItem(
      getDashboardStorageKey(user.role, "messagingView"),
    );
    if (savedMessagingView) {
      setMessagingView(savedMessagingView);
    }

    if (user.role === "admin") {
      const savedAdminView = localStorage.getItem(
        getDashboardStorageKey(user.role, "adminView"),
      );
      if (savedAdminView) {
        setAdminView(savedAdminView);
      }

      const savedAdminMessagingView = localStorage.getItem(
        getDashboardStorageKey(user.role, "adminMessagingView"),
      );
      if (savedAdminMessagingView) {
        setAdminMessagingView(savedAdminMessagingView);
      }
    }
  }, [user?.role]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (user.role === "admin") {
      loadAdminData();
    } else if (user.role === "clinician") {
      loadClinicianApprovalStatus();
      loadData();
      loadMessageRequests();
      loadConversations();
    } else if (user.role === "patient") {
      loadData();
      loadConversations();
    }

    loadProfile();
  }, [user, navigate, authLoading]);

  useEffect(() => {
    if (!user?.role) return;
    localStorage.setItem(
      getDashboardStorageKey(user.role, "currentView"),
      currentView,
    );
  }, [currentView, user?.role]);

  useEffect(() => {
    if (!user?.role) return;
    localStorage.setItem(
      getDashboardStorageKey(user.role, "messagingView"),
      messagingView,
    );
  }, [messagingView, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    localStorage.setItem(
      getDashboardStorageKey(user.role, "adminView"),
      adminView,
    );
  }, [adminView, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    localStorage.setItem(
      getDashboardStorageKey(user.role, "adminMessagingView"),
      adminMessagingView,
    );
  }, [adminMessagingView, user?.role]);

  const loadData = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("access_token");

      if (user?.role === "patient") {
        const [recordsRes, healthSummaryRes] = await Promise.all([
          axios.get("/api/records", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("/api/records/health-summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setRecords(recordsRes.data.records);
        setHealthSummary(healthSummaryRes.data);
        console.log("Health Summary:", healthSummaryRes.data);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };
  // Fetch AI health tips
  const fetchHealthTips = async () => {
    try {
      setHealthTipsLoading(true);
      const res = await axios.get("/api/health-tips?count=1");
      setHealthTips(res.data.tips || []);
    } catch (err) {
      console.error("Error loading health tips:", err);
    } finally {
      setHealthTipsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "patient") {
      loadData();
      fetchHealthTips();
    }
  }, [user]);

  const loadRecordDetails = async (recordId) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get(`/api/records/${recordId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecordDetails(res.data);
      setShowRecordModal(true);
    } catch (err) {
      console.error("Error loading record details:", err);
      alert("Error loading record details");
    }
  };
  const handleDeleteRecord = async (recordId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this record?",
    );
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("access_token");

      await axios.delete(`/api/records/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // remove from UI instantly
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete record");
    }
  };

  const loadClinicians = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/clinicians", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinicians(res.data.clinicians);
    } catch (err) {
      console.error("Error loading clinicians:", err);
    }
  };

  const loadMessageRequests = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/message-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessageRequests(res.data.requests);
    } catch (err) {
      console.error("Error loading requests:", err);
    }
  };

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileWithDefaults = {
        ...res.data,
        countryCode: res.data.countryCode || "+91",
        emergencyCountryCode: res.data.emergencyCountryCode || "+91",
        phone: res.data.phone || "",
        emergencyPhone: res.data.emergencyPhone || "",
      };
      const profileWithCountry = {
        ...res.data,
        countryCode: res.data.countryCode || "+91",
      };
      setProfileData(profileWithCountry);
      setEditedProfile(profileWithCountry);
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  };

  const loadAdminUsers = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/admin/users-for-messaging", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminUsers(res.data.users);
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const loadAdminConversations = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/admin/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminConversations(res.data.conversations);
    } catch (err) {
      console.error("Error loading admin conversations:", err);
    }
  };

  const loadAdminMessages = async (otherUserEmail) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get(
        `/api/messages/conversation/${otherUserEmail}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAdminMessages(res.data.messages);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };
  const loadAllPatients = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/admin/patients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllPatients(res.data.patients || []);
    } catch (err) {
      console.error("Error loading patients:", err);
    }
  };

  const handleAdminSendMessage = async () => {
    if (!adminNewMessage.trim() || !adminSelectedConversation) return;

    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        "/api/admin/send-message",
        {
          recipient_email: adminSelectedConversation.other_user_email,
          recipient_role: adminSelectedConversation.other_user_role,
          message: adminNewMessage,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAdminNewMessage("");
      loadAdminMessages(adminSelectedConversation.other_user_email);
      loadAdminConversations();
    } catch (err) {
      alert("Error sending message");
    }
  };

  const handleSaveProfile = async () => {
    if (
      user?.role === "patient" &&
      editedProfile.age !== "" &&
      editedProfile.age !== null &&
      editedProfile.age !== undefined
    ) {
      const parsedAge = Number(editedProfile.age);
      if (!Number.isInteger(parsedAge) || parsedAge < 0) {
        alert("Age cannot be negative");
        return;
      }
    }

    try {
      const token = localStorage.getItem("access_token");
      await axios.put("/api/profile", editedProfile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfileData(editedProfile);

      // Update user in localStorage
      const storedUser = JSON.parse(localStorage.getItem("user"));
      storedUser.name = editedProfile.name;
      localStorage.setItem("user", JSON.stringify(storedUser));

      setShowProfileModal(false);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Error updating profile");
    }
  };
  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete your account and all associated data. This action cannot be undone. Do you want to delete your account?",
    );

    if (!confirmed) return;

    try {
      await axios.delete("/api/auth/delete-account", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      localStorage.removeItem("access_token"); // remove token
      logout(); // your logout function
      navigate("/"); // redirect to home/login
      alert("✅ Account deleted successfully");
    } catch (err) {
      console.error("Delete account failed:", err);
      alert(
        "❌ Error deleting account: " +
          (err.response?.data?.detail || "Unknown error"),
      );
    } finally {
    }
  };
  const loadConversations = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(res.data.conversations);
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  };

  const loadConversationMessages = async (otherUserEmail) => {
    try {
      const token = localStorage.getItem("access_token");

      // Load messages and attachments in parallel
      const [messagesRes, attachmentsRes] = await Promise.all([
        axios.get(`/api/messages/conversation/${otherUserEmail}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios
          .get(`/api/chat/attachments/${otherUserEmail}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .catch(() => ({ data: { attachments: [] } })), // Fallback if endpoint doesn't exist yet
      ]);

      // Merge messages with attachments
      const messages = messagesRes.data.messages;
      const attachments = attachmentsRes.data.attachments || [];

      // Match attachments to messages based on timestamp proximity
      const messagesWithAttachments = messages.map((msg) => {
        const msgTime = new Date(msg.sent_at).getTime();
        const attachment = attachments.find((att) => {
          const attTime = new Date(att.uploaded_at).getTime();
          return (
            Math.abs(msgTime - attTime) < 5000 && att.is_mine === msg.is_mine
          );
        });

        return {
          ...msg,
          attachment: attachment || null,
        };
      });

      setConversationMessages(messagesWithAttachments);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const handleRequestMessage = async (clinicianEmail) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        "/api/message-requests",
        { clinician_email: clinicianEmail },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alert("Request sent successfully!");
      loadMessageRequests();
    } catch (err) {
      alert(err.response?.data?.detail || "Error sending request");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.put(
        `/api/message-requests/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      loadMessageRequests();
      loadConversations();
      alert("Request accepted!");
    } catch (err) {
      alert("Error accepting request");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.put(
        `/api/message-requests/${requestId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      loadMessageRequests();
      alert("Request rejected");
    } catch (err) {
      alert("Error rejecting request");
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        "/api/messages/send",
        {
          recipient_email: selectedConversation.other_user_email,
          recipient_role: selectedConversation.other_user_role,
          message: newMessage,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNewMessage("");
      loadConversationMessages(selectedConversation.other_user_email);
      loadConversations();
    } catch (err) {
      alert("Error sending message");
    }
  };

  const startEditingMessage = (msg) => {
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.message || "");
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText("");
  };

  const saveEditedMessage = async () => {
    if (!editingMessageId || !editingMessageText.trim()) {
      cancelEditingMessage();
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      await axios.put(
        `/api/messages/${editingMessageId}/edit`,
        { message: editingMessageText },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      cancelEditingMessage();

      if (selectedConversation) {
        await loadConversationMessages(selectedConversation.other_user_email);
        await loadConversations();
      }
      if (adminSelectedConversation) {
        await loadAdminMessages(adminSelectedConversation.other_user_email);
        await loadAdminConversations();
      }
    } catch (err) {
      console.error("Error editing message:", err);
      alert(err.response?.data?.detail || "Error editing message");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message for both sides?")) return;

    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(`/api/messages/${messageId}/delete`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (selectedConversation) {
        await loadConversationMessages(selectedConversation.other_user_email);
        await loadConversations();
      }
      if (adminSelectedConversation) {
        await loadAdminMessages(adminSelectedConversation.other_user_email);
        await loadAdminConversations();
      }
    } catch (err) {
      console.error("Error deleting message:", err);
      alert(err.response?.data?.detail || "Error deleting message");
    }
  };

  const handleChatAttachmentUpload = async (file, conversation) => {
    if (!file || !conversation) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    const confirmSend = window.confirm(
      `Send attachment \"${file.name}\" to ${conversation.other_user_name || conversation.other_user_email}?`,
    );
    if (!confirmSend) return;

    const customMessage = window.prompt(
      "Optional: add a message for this file",
      `📎 Sent a file: ${file.name}`,
    );

    if (customMessage === null) return;

    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recipient_email", conversation.other_user_email);

      await axios.post("/api/chat/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      await axios.post(
        "/api/messages/send",
        {
          recipient_email: conversation.other_user_email,
          recipient_role: conversation.other_user_role,
          message: customMessage.trim() || `📎 Sent a file: ${file.name}`,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      loadConversationMessages(conversation.other_user_email);
      loadConversations();
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Error uploading file");
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFileName(file.name);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "General");
    formData.append("record_type", "Medical Report");
    console.log("TOKEN:", localStorage.getItem("access_token"));
    try {
      // Simulate progress (since we can't track real upload progress easily with axios)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await axios.post("/api/records/upload", formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Wait a moment to show 100% before hiding
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadFileName("");
        loadData();
      }, 1000);
    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadFileName("");
      alert("Error uploading file");
    }

    // Reset file input
    e.target.value = "";
  };

  useEffect(() => {
    if (currentView === "messages") {
      if (user?.role === "patient") {
        loadClinicians();
        loadMessageRequests();
        loadConversations();
      } else if (user?.role === "clinician") {
        loadMessageRequests();
        loadConversations();
      }
    }
  }, [currentView]);
  const loadAdminData = async () => {
    try {
      const token = localStorage.getItem("access_token");

      const [
        statsResult,
        requestsResult,
        cliniciansResult,
        logsResult,
        patientsResult,
      ] = await Promise.allSettled([
        axios.get("/api/admin/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/clinician-requests?status=pending", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/clinicians", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/audit-logs", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get("/api/admin/patients", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsResult.status === "fulfilled")
        setAdminStats(statsResult.value.data);
      if (requestsResult.status === "fulfilled")
        setClinicianRequests(requestsResult.value.data.requests || []);
      if (cliniciansResult.status === "fulfilled")
        setAllClinicians(cliniciansResult.value.data.clinicians || []);
      if (logsResult.status === "fulfilled")
        setAuditLogs(logsResult.value.data.logs || []);
      if (patientsResult.status === "fulfilled") {
        setAllPatients(patientsResult.value.data.patients || []);
      } else {
        console.error("Error loading patients data:", patientsResult.reason);
      }
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  };

  const handleApproveClinicianRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to approve this clinician?"))
      return;

    // const tempPassword = prompt("Enter temporary password for the clinician (they will change it on first login):", "ChangeMe123!");
    // if (!tempPassword) return;

    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.post(
        `/api/admin/approve-clinician-request/${requestId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      alert("Clinician approved successfully!");

      // if (res.data.temporary_password) {
      //   alert(`Clinician approved! Temporary password: ${res.data.temporary_password}\nPlease share this with the clinician securely.`);
      // } else {
      //   alert("Clinician approved successfully!");
      // }

      // Reload all admin data to refresh the UI
      loadAdminData();
    } catch (err) {
      alert(
        "Error approving clinician: " +
          (err.response?.data?.detail || err.message),
      );
    }
  };

  const handleRejectClinicianRequest = async (requestId) => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;

    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        `/api/admin/reject-clinician-request/${requestId}`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      alert("Request rejected");
      // Reload all admin data to refresh the UI
      loadAdminData();
    } catch (err) {
      alert("Error rejecting request");
    }
  };

  const handleToggleClinicianStatus = async (clinicianId) => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.put(
        `/api/admin/clinician/${clinicianId}/toggle-status`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      loadAdminData();
    } catch (err) {
      alert("Error toggling clinician status");
    }
  };

  const openAdminUserActionModal = (action, role, userId, userName) => {
    setAdminUserActionModal({
      open: true,
      action,
      role,
      userId,
      userName,
    });
  };

  const closeAdminUserActionModal = () => {
    setAdminUserActionModal({
      open: false,
      role: "",
      userId: null,
      userName: "",
      action: "deactivate",
    });
  };

  const handleAdminUserAction = async () => {
    const { action, role, userId, userName } = adminUserActionModal;

    if (!role || !userId) return;

    try {
      const token = localStorage.getItem("access_token");
      if (action === "restore") {
        await axios.put(
          `/api/admin/users/${role}/${userId}/restore`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } else if (action === "delete") {
        await axios.delete(`/api/admin/users/${role}/${userId}/permanent`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.delete(`/api/admin/users/${role}/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (adminSelectedConversation?.other_user_email) {
        setAdminSelectedConversation(null);
        setAdminMessages([]);
      }

      alert(
        action === "restore"
          ? `${userName}'s account has been restored.`
          : action === "delete"
            ? `${userName}'s account has been permanently deleted.`
            : `${userName}'s account has been deactivated.`,
      );
      closeAdminUserActionModal();
      loadAdminData();
      loadAdminUsers();
      loadAdminConversations();
    } catch (err) {
      const actionLabel =
        action === "restore"
          ? "restoring"
          : action === "delete"
            ? "deleting"
            : "deactivating";
      alert(
        err.response?.data?.detail || `Error ${actionLabel} ${role} account`,
      );
    }
  };

  const loadClinicianApprovalStatus = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await axios.get("/api/clinician/approval-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinicianApprovalStatus(res.data);
    } catch (err) {
      console.error("Error loading approval status:", err);
    }
  };

  const handleRequestApproval = async () => {
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        "/api/clinician/request-approval",
        {
          message: approvalRequestMessage,
          phone: editedProfile.phone,
          specialization: editedProfile.specialization,
          license_number: editedProfile.license_number,
          department: editedProfile.department,
          years_of_experience: editedProfile.years_of_experience,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setShowApprovalRequestModal(false);
      setApprovalRequestMessage("");
      alert("Approval request submitted successfully!");

      // Reload profile and approval status
      loadProfile();
      loadClinicianApprovalStatus();
    } catch (err) {
      alert(err.response?.data?.detail || "Error submitting approval request");
    }
  };

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Load messaging data on initial mount
    if (user.role === "patient") {
      loadClinicians();
      loadMessageRequests();
      loadConversations();
    } else if (user.role === "clinician") {
      loadMessageRequests();
      loadConversations();
    } else if (user.role === "admin") {
      loadAdminUsers();
      loadAdminConversations();
    }
  }, [user]);
  const totalUnread = conversations.reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0,
  );

  const filteredClinicians = useMemo(() => {
    const searchTerm = clinicianSearch.trim().toLowerCase();

    if (!searchTerm) return allClinicians;

    return allClinicians.filter((clinician) =>
      String(clinician.specialization || "")
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [allClinicians, clinicianSearch]);

  const adminVisiblePatients = useMemo(() => {
    const searchTerm = adminPatientSearch.trim().toLowerCase();

    return allPatients.filter((patient) => {
      const matchesSearch =
        !searchTerm ||
        [
          patient.name,
          patient.email,
          patient.phone,
          patient.blood_type,
          patient.status,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(searchTerm),
        );

      const matchesStatus =
        adminPatientStatusFilter === "all" ||
        patient.status === adminPatientStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allPatients, adminPatientSearch, adminPatientStatusFilter]);

  const adminPatientAnalytics = useMemo(() => {
    const statusCounts = { stable: 0, attention: 0, critical: 0 };
    const ageGroups = [
      { label: "0-17", count: 0 },
      { label: "18-35", count: 0 },
      { label: "36-50", count: 0 },
      { label: "51-65", count: 0 },
      { label: "65+", count: 0 },
    ];
    const bloodTypeCounts = {};
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const now = new Date();
    const monthlyRegistrations = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: monthFormatter.format(date),
        count: 0,
      };
    });

    let activeCount = 0;
    let totalAlerts = 0;
    let totalAge = 0;
    let patientsWithAge = 0;

    allPatients.forEach((patient) => {
      const status = patient.status || "stable";
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      }

      if (patient.is_active) {
        activeCount += 1;
      }

      totalAlerts += Number(patient.alerts || 0);

      const age = Number(patient.age);
      if (!Number.isNaN(age) && age > 0) {
        totalAge += age;
        patientsWithAge += 1;

        if (age <= 17) ageGroups[0].count += 1;
        else if (age <= 35) ageGroups[1].count += 1;
        else if (age <= 50) ageGroups[2].count += 1;
        else if (age <= 65) ageGroups[3].count += 1;
        else ageGroups[4].count += 1;
      }

      const bloodType = patient.blood_type || "Unknown";
      bloodTypeCounts[bloodType] = (bloodTypeCounts[bloodType] || 0) + 1;

      if (patient.created_at) {
        const createdAt = new Date(patient.created_at);
        const monthKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
        const existingMonth = monthlyRegistrations.find(
          (month) => month.key === monthKey,
        );
        if (existingMonth) {
          existingMonth.count += 1;
        }
      }
    });

    const bloodTypeDistribution = Object.entries(bloodTypeCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const maxMonthlyRegistrations = Math.max(
      ...monthlyRegistrations.map((item) => item.count),
      1,
    );

    return {
      statusCounts,
      ageGroups,
      bloodTypeDistribution,
      monthlyRegistrations,
      maxMonthlyRegistrations,
      activeCount,
      inactiveCount: Math.max(allPatients.length - activeCount, 0),
      totalAlerts,
      averageAge: patientsWithAge
        ? Math.round(totalAge / patientsWithAge)
        : null,
      recentPatients: [...allPatients]
        .sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
        )
        .slice(0, 5),
    };
  }, [allPatients]);

  const getPatientStatusClasses = (status) => {
    if (status === "stable") return "bg-green-100 text-green-700";
    if (status === "attention") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  useEffect(() => {
    if (!selectedConversation || !conversationScrollRef.current) return;

    conversationScrollRef.current.scrollTo({
      top: conversationScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversationMessages, selectedConversation]);

  useEffect(() => {
    if (!adminSelectedConversation || !adminConversationScrollRef.current)
      return;

    adminConversationScrollRef.current.scrollTo({
      top: adminConversationScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [adminMessages, adminSelectedConversation]);

  const tabButton = (view, label, icon) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`relative flex items-center gap-2 px-5 py-2 rounded-md font-medium transition-all duration-300 ${
        currentView === view
          ? "bg-blue-600 text-white shadow-lg"
          : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
      }`}
    >
      <i className={`fas ${icon}`}></i> {label}
      {view === "messages" && totalUnread > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          {totalUnread > 99 ? "99+" : totalUnread}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-heartbeat text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                CareConnect Pro
              </h1>
              <p className="text-xs text-gray-600 capitalize">
                {user?.role || "Healthcare Communication Platform"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            {user?.role === "patient" && (
                <EmergencyAlertButton />
            )}
            <Notifications />
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <i
                    className={`fas ${user?.role === "patient" ? "fa-user" : "fa-user-md"} text-white text-sm`}
                  ></i>
                </div>
                <span className="font-medium text-sm text-gray-700">
                  {user?.name}
                </span>
                <i
                  className={`fas fa-chevron-down text-xs text-gray-500 transition-transform ${showProfileDropdown ? "rotate-180" : ""}`}
                ></i>
              </button>
              {/* Dropdown Menu */}
              <AnimatePresence>
                {showProfileDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                  >
                    <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <p className="font-semibold">
                        {profileData.name || user?.name}
                      </p>
                      <p className="text-xs opacity-90">
                        {profileData.email || user?.email}
                      </p>
                      <p className="text-xs mt-1 capitalize bg-white/20 inline-block px-2 py-0.5 rounded">
                        {user?.role}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowProfileModal(true);
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition"
                    >
                      <i className="fas fa-user-circle text-blue-600"></i>
                      <span className="text-gray-700 font-medium">
                        User Details
                      </span>
                    </button>
                    <button
                      onClick={logout}
                      className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 transition border-t"
                    >
                      <i className="fas fa-sign-out-alt text-red-600"></i>
                      <span className="text-red-600 font-medium">Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>
      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <i
                        className={`fas ${user?.role === "patient" ? "fa-user" : "fa-user-md"} text-2xl`}
                      ></i>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">User Profile</h2>
                      <p className="text-sm opacity-90 capitalize">
                        {user?.role} Account
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Common Fields */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                    Basic Information
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editedProfile.name || ""}
                      placeholder="Enter full name"
                      onChange={(e) => {
                        const value = e.target.value;

                        // ✅ Allow only alphabets and spaces
                        if (/^[A-Za-z\s]*$/.test(value)) {
                          setEditedProfile({
                            ...editedProfile,
                            name: value,
                          });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg
             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editedProfile.email || ""}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>

                    <div className="flex gap-2">
                      {/* Country Dropdown */}
                      <select
                        value={editedProfile.countryCode || "+91"}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            countryCode: e.target.value,
                            phone: "",
                          })
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                      >
                        {countries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>

                      {/* Phone Input */}
                      <input
                        type="tel"
                        value={editedProfile.phone || ""}
                        onChange={(e) => {
                          const selectedCountry = countries.find(
                            (c) => c.code === editedProfile.countryCode,
                          );
                          const maxLength = selectedCountry?.maxLength || 10;
                          const value = e.target.value.replace(/\D/g, "");

                          if (value.length <= maxLength) {
                            setEditedProfile({
                              ...editedProfile,
                              phone: value,
                            });
                          }
                        }}
                        placeholder="Enter phone number"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Error message */}
                    {editedProfile.phone &&
                      (() => {
                        const selectedCountry = countries.find(
                          (c) => c.code === editedProfile.countryCode,
                        );
                        return (
                          editedProfile.phone.length !==
                          selectedCountry?.maxLength
                        );
                      })() && (
                        <p className="text-red-500 text-sm mt-1">
                          Invalid phone number for selected country
                        </p>
                      )}
                  </div>
                </div>

                {/* Patient-Specific Fields */}
                {user?.role === "patient" && (
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                      Medical Information
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Age
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editedProfile.age ?? ""}
                          placeholder="25"
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");

                            // Optional limit (0–120)
                            if (value === "" || Number(value) <= 120) {
                              setEditedProfile({
                                ...editedProfile,
                                age: value, // ✅ keep as STRING
                              });
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg
             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Blood Type
                        </label>
                        <select
                          value={editedProfile.blood_type || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              blood_type: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select Blood Type</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <textarea
                        value={editedProfile.address || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            address: e.target.value,
                          })
                        }
                        placeholder="123 Main St, City, State, ZIP"
                        rows="2"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Emergency Contact
                      </label>

                      <div className="flex gap-2">
                        <select
                          value={editedProfile.emergencyCountryCode || "+91"}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              emergencyCountryCode: e.target.value,
                              emergencyPhone: "",
                            })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                        >
                          {countries.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>

                        <input
                          type="tel"
                          value={editedProfile.emergencyPhone || ""}
                          onChange={(e) => {
                            const selectedCountry = countries.find(
                              (c) =>
                                c.code === editedProfile.emergencyCountryCode,
                            );
                            const maxLength = selectedCountry?.maxLength || 10;
                            const value = e.target.value.replace(/\D/g, "");

                            if (value.length <= maxLength) {
                              setEditedProfile({
                                ...editedProfile,
                                emergencyPhone: value,
                              });
                            }
                          }}
                          placeholder="Enter emergency contact number"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* Error message */}
                      {editedProfile.emergencyPhone &&
                        (() => {
                          const selectedCountry = countries.find(
                            (c) =>
                              c.code === editedProfile.emergencyCountryCode,
                          );
                          return (
                            selectedCountry &&
                            editedProfile.emergencyPhone.length !==
                              selectedCountry.maxLength
                          );
                        })() && (
                          <p className="text-red-500 text-sm mt-1">
                            Invalid emergency contact number for selected
                            country
                          </p>
                        )}
                    </div>
                  </div>
                )}

                {/* Clinician-Specific Fields */}
                {user?.role === "clinician" && (
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                      Professional Information
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Specialization
                      </label>
                      <input
                        type="text"
                        value={editedProfile.specialization || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            specialization: e.target.value,
                          })
                        }
                        placeholder="Cardiology, Neurology, etc."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={editedProfile.license_number || ""}
                        onChange={(e) =>
                          setEditedProfile({
                            ...editedProfile,
                            license_number: e.target.value,
                          })
                        }
                        placeholder="MD123456"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={editedProfile.department || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              department: e.target.value,
                            })
                          }
                          placeholder="Emergency, ICU, etc."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Years of Experience
                        </label>
                        <input
                          type="number"
                          value={editedProfile.years_of_experience || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              years_of_experience: parseInt(e.target.value),
                            })
                          }
                          placeholder="5"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Info */}
                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                    Account Information
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <p className="flex justify-between">
                      <span className="text-gray-600">Account Status:</span>
                      <span className="font-semibold text-green-600">
                        <i className="fas fa-check-circle mr-1"></i>Active
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Member Since:</span>
                      <span className="font-semibold text-gray-800">
                        {profileData.created_at
                          ? new Date(
                              profileData.created_at,
                            ).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl flex gap-3 border-t">
                {/* Cancel */}
                <button
                  onClick={() => {
                    setEditedProfile(profileData);
                    setShowProfileModal(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>

                {/* Save Changes */}
                <button
                  onClick={handleSaveProfile}
                  disabled={editedProfile.phone && !isPhoneValid()}
                  className={`flex-1 px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                    editedProfile.phone && !isPhoneValid()
                      ? "bg-gray-400 cursor-not-allowed opacity-50"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  <i className="fas fa-save"></i>
                  Save Changes
                </button>

                {/* Delete Account */}
                <button
                  onClick={handleDeleteAccount}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                >
                  Delete Account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adminUserActionModal.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeAdminUserActionModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    adminUserActionModal.action === "restore"
                      ? "bg-green-100"
                      : adminUserActionModal.action === "delete"
                        ? "bg-rose-100"
                        : "bg-red-100"
                  }`}
                >
                  <i
                    className={`fas ${
                      adminUserActionModal.action === "restore"
                        ? "fa-rotate-left text-green-600"
                        : adminUserActionModal.action === "delete"
                          ? "fa-trash text-rose-600"
                          : "fa-user-slash text-red-600"
                    } text-lg`}
                  ></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {adminUserActionModal.action === "restore"
                      ? "Restore Account"
                      : adminUserActionModal.action === "delete"
                        ? "Delete Account Permanently"
                        : "Deactivate Account"}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">
                    {adminUserActionModal.role} account action
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                {adminUserActionModal.action === "restore"
                  ? `Restore ${adminUserActionModal.userName}'s account and allow them to access the platform again?`
                  : adminUserActionModal.action === "delete"
                    ? `Permanently delete ${adminUserActionModal.userName}'s account? This will remove their records/messages and cannot be undone.`
                    : `Deactivate ${adminUserActionModal.userName}'s account? Their data will be preserved and you can restore access later.`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={closeAdminUserActionModal}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdminUserAction}
                  className={`flex-1 px-4 py-2 rounded-lg text-white transition ${
                    adminUserActionModal.action === "restore"
                      ? "bg-green-600 hover:bg-green-700"
                      : adminUserActionModal.action === "delete"
                        ? "bg-rose-700 hover:bg-rose-800"
                        : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {adminUserActionModal.action === "restore"
                    ? "Restore"
                    : adminUserActionModal.action === "delete"
                      ? "Delete Permanently"
                      : "Deactivate"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <div className="flex justify-center mt-6 gap-3 flex-wrap">
        {tabButton(
          "dashboard",
          user?.role === "admin" ? "Admin Center" : "Dashboard",
          user?.role === "admin" ? "fa-shield-alt" : "fa-chart-line",
        )}

        {user?.role !== "admin" &&
          tabButton("messages", "Messages", "fa-comments")}

        {user?.role === "patient" &&
          tabButton("records", "Records", "fa-file-medical")}

        {user?.role === "patient" &&
          tabButton("timeline", "Timeline", "fa-timeline")}

        {["patient", "admin", "clinician"].includes(user?.role) &&
  tabButton("emergency-alerts", "Emergency Alerts", "fa-triangle-exclamation")}  

        {user?.role === "patient" &&
          tabButton("meal-planner", "Meal Planner", "fa-utensils")}

        {user?.role !== "admin" &&
          tabButton("appointments", "Appointments", "fa-calendar-check")}

        {user?.role !== "admin" &&
          tabButton(
            "prescriptions",
            "Prescriptions",
            "fa-prescription-bottle-medical",
          )}
      </div>
      {/* Main Content */}
      <motion.main
        className="max-w-7xl mx-auto p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* ===== CLINICIAN DASHBOARD ===== */}
        {currentView === "dashboard" && user?.role === "clinician" && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <motion.div
              className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <h2 className="text-2xl font-bold mb-2">
                Welcome, Dr. {user?.name}!{" "}
                {profileData?.gender?.toLowerCase() === "female" ? "👩‍⚕️" : "👨‍⚕️"}
              </h2>
              <p className="opacity-90">Your patient overview for today</p>
            </motion.div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Patients</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {conversations.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-blue-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Requests</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {messageRequests.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-yellow-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Active Chats</p>
                    <p className="text-3xl font-bold text-green-600">
                      {conversations.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-comments text-green-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Response Rate</p>
                    <p className="text-3xl font-bold text-purple-600">98%</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-chart-line text-purple-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - 2/3 width */}
              <div className="lg:col-span-2 space-y-6">
                {/* Pending Requests */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                      Pending Patient Requests
                    </h3>
                    <button
                      onClick={() => {
                        setCurrentView("messages");
                        setMessagingView("requests");
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {messageRequests.slice(0, 3).map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-yellow-600"></i>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {req.patient_name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {req.patient_email}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(req.requested_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(req.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition text-sm"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition text-sm"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {messageRequests.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <i className="fas fa-check-circle text-4xl text-green-500 mb-2"></i>
                        <p>No pending requests</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Recent Patients */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                      Recent Patient Conversations
                    </h3>
                    <button
                      onClick={() => setCurrentView("messages")}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {conversations.slice(0, 4).map((conv) => (
                      <div
                        key={conv.conversation_id}
                        onClick={() => {
                          setCurrentView("messages");
                          setMessagingView("conversations");
                          setSelectedConversation(conv);
                          loadConversationMessages(conv.other_user_email);
                        }}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-blue-600"></i>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {conv.other_user_name}
                            </h4>
                            <p className="text-sm text-gray-600 truncate max-w-xs">
                              {conv.last_message}
                            </p>
                          </div>
                        </div>
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <p className="text-center text-gray-500 py-8">
                        No patient conversations yet
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Sidebar - 1/3 width */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setCurrentView("messages");
                        setMessagingView("requests");
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition text-left"
                    >
                      <div className="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-inbox text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          View Requests
                        </p>
                        <p className="text-xs text-gray-600">
                          {messageRequests.length} pending
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setCurrentView("messages");
                        setMessagingView("conversations");
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left"
                    >
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-comments text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          My Patients
                        </p>
                        <p className="text-xs text-gray-600">
                          {conversations.length} active chats
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileModal(true);
                      }}
                      className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-left"
                    >
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-user-circle text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          Update Profile
                        </p>
                        <p className="text-xs text-gray-600">
                          Edit your information
                        </p>
                      </div>
                    </button>
                  </div>
                </motion.div>

                {/* Today's Overview */}
                <motion.div
                  className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Today's Overview
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        New Messages
                      </span>
                      <span className="font-bold text-indigo-600">
                        {conversations.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Pending Requests
                      </span>
                      <span className="font-bold text-yellow-600">
                        {messageRequests.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Active Patients
                      </span>
                      <span className="font-bold text-green-600">
                        {conversations.length}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Professional Tip */}
                <motion.div
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <i className="fas fa-stethoscope text-blue-600 text-xl"></i>
                    <h3 className="text-lg font-bold text-gray-800">Pro Tip</h3>
                  </div>
                  <p className="text-sm text-gray-700">
                    Respond to patient messages within 24 hours to maintain high
                    satisfaction rates and build trust.
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* ===== CLINICIAN PENDING APPROVAL SCREEN ===== */}
        {user?.role === "clinician" &&
          clinicianApprovalStatus?.approval_status !== "approved" && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {/* Pending Status */}
                {clinicianApprovalStatus?.approval_status === "pending" && (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-clock text-yellow-600 text-4xl"></i>
                      </div>
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">
                        Account Pending Approval
                      </h2>
                      <p className="text-gray-600">
                        Your clinician account is awaiting admin approval.
                      </p>
                    </div>

                    {clinicianApprovalStatus?.has_pending_request ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                        <div className="flex items-start gap-3">
                          <i className="fas fa-info-circle text-blue-600 text-xl mt-1"></i>
                          <div>
                            <h3 className="font-semibold text-blue-900 mb-2">
                              Approval Request Submitted
                            </h3>
                            <p className="text-blue-800 text-sm mb-2">
                              You submitted an approval request on{" "}
                              {new Date(
                                clinicianApprovalStatus.pending_request
                                  .requested_at,
                              ).toLocaleDateString()}
                            </p>
                            {clinicianApprovalStatus.pending_request
                              .message && (
                              <div className="bg-white rounded p-3 mt-2">
                                <p className="text-sm text-gray-700">
                                  <strong>Your message:</strong>{" "}
                                  {
                                    clinicianApprovalStatus.pending_request
                                      .message
                                  }
                                </p>
                              </div>
                            )}
                            <p className="text-blue-700 text-sm mt-3">
                              Our admin team is reviewing your request. You'll
                              receive an email once your account is approved.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                        <h3 className="font-semibold text-gray-800 mb-3">
                          Request Admin Approval
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                          To access the CareConnect Pro network and connect with
                          patients, you need to request approval from an
                          administrator.
                        </p>
                        <button
                          onClick={() => setShowApprovalRequestModal(true)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
                        >
                          <i className="fas fa-paper-plane mr-2"></i>
                          Request Approval
                        </button>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3">
                        What happens next?
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <i className="fas fa-check text-green-600 mt-1"></i>
                          <span>
                            Submit your approval request with your credentials
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i className="fas fa-check text-green-600 mt-1"></i>
                          <span>
                            Admin reviews your profile and qualifications
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i className="fas fa-check text-green-600 mt-1"></i>
                          <span>
                            Once approved, you'll have full access to the
                            platform
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i className="fas fa-check text-green-600 mt-1"></i>
                          <span>
                            You'll be visible to patients and can start
                            consultations
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="mt-6 text-center">
                      <button
                        onClick={logout}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        <i className="fas fa-sign-out-alt mr-2"></i>
                        Logout
                      </button>
                    </div>
                  </>
                )}

                {/* Rejected Status */}
                {clinicianApprovalStatus?.approval_status === "rejected" && (
                  <>
                    <div className="text-center mb-6">
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-times-circle text-red-600 text-4xl"></i>
                      </div>
                      <h2 className="text-3xl font-bold text-gray-800 mb-2">
                        Application Rejected
                      </h2>
                      <p className="text-gray-600">
                        Unfortunately, your application was not approved at this
                        time.
                      </p>
                    </div>

                    {clinicianApprovalStatus?.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h3 className="font-semibold text-red-900 mb-2">
                          Reason for Rejection
                        </h3>
                        <p className="text-red-800 text-sm">
                          {clinicianApprovalStatus.rejection_reason}
                        </p>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <h4 className="font-semibold text-gray-800 mb-2">
                        What can you do?
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start gap-2">
                          <i className="fas fa-arrow-right text-gray-500 mt-1"></i>
                          <span>
                            Update your profile with correct information
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i className="fas fa-arrow-right text-gray-500 mt-1"></i>
                          <span>Submit a new approval request</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i className="fas fa-arrow-right text-gray-500 mt-1"></i>
                          <span>Contact support for more information</span>
                        </li>
                      </ul>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
                      >
                        <i className="fas fa-edit mr-2"></i>
                        Update Profile
                      </button>
                      <button
                        onClick={() => setShowApprovalRequestModal(true)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
                      >
                        <i className="fas fa-redo mr-2"></i>
                        Reapply
                      </button>
                    </div>

                    <div className="mt-6 text-center">
                      <button
                        onClick={logout}
                        className="text-red-600 hover:text-red-700 font-medium text-sm"
                      >
                        <i className="fas fa-sign-out-alt mr-2"></i>
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

        {/* Approval Request Modal - ENHANCED */}
        <AnimatePresence>
          {showApprovalRequestModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowApprovalRequestModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800">
                    Request Admin Approval
                  </h3>
                  <button
                    onClick={() => setShowApprovalRequestModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">
                    Please fill in or verify your professional details before
                    submitting your approval request.
                  </p>

                  {/* Professional Details Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Specialization *
                        </label>
                        <input
                          type="text"
                          value={editedProfile.specialization || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              specialization: e.target.value,
                            })
                          }
                          placeholder="e.g., Neurology, Cardiology"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          License Number *
                        </label>
                        <input
                          type="text"
                          value={editedProfile.license_number || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              license_number: e.target.value,
                            })
                          }
                          placeholder="e.g., MD13545"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Department *
                        </label>
                        <input
                          type="text"
                          value={editedProfile.department || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              department: e.target.value,
                            })
                          }
                          placeholder="e.g., ER, ICU"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Years of Experience *
                        </label>
                        <input
                          type="number"
                          value={editedProfile.years_of_experience || ""}
                          onChange={(e) =>
                            setEditedProfile({
                              ...editedProfile,
                              years_of_experience: parseInt(e.target.value),
                            })
                          }
                          placeholder="e.g., 3"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          min="0"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number
                        </label>

                        <div className="flex gap-2">
                          {/* Country Dropdown */}
                          <select
                            value={editedProfile.countryCode || "+91"}
                            onChange={(e) =>
                              setEditedProfile({
                                ...editedProfile,
                                countryCode: e.target.value,
                                phone: "",
                              })
                            }
                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                          >
                            {countries.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>

                          {/* Phone Input */}
                          <input
                            type="tel"
                            value={editedProfile.phone || ""}
                            onChange={(e) => {
                              const selectedCountry = countries.find(
                                (c) => c.code === editedProfile.countryCode,
                              );
                              const maxLength =
                                selectedCountry?.maxLength || 10;
                              const value = e.target.value.replace(/\D/g, "");

                              if (value.length <= maxLength) {
                                setEditedProfile({
                                  ...editedProfile,
                                  phone: value,
                                });
                              }
                            }}
                            placeholder="Enter phone number"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* Error message */}
                        {editedProfile.phone &&
                          (() => {
                            const selectedCountry = countries.find(
                              (c) => c.code === editedProfile.countryCode,
                            );
                            return (
                              editedProfile.phone.length !==
                              selectedCountry?.maxLength
                            );
                          })() && (
                            <p className="text-red-500 text-sm mt-1">
                              Invalid phone number for selected country
                            </p>
                          )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Message to Admin *
                      </label>
                      <textarea
                        value={approvalRequestMessage}
                        onChange={(e) =>
                          setApprovalRequestMessage(e.target.value)
                        }
                        rows="4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Tell the admin why you want to join CareConnect Pro..."
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApprovalRequestModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestApproval}
                    disabled={
                      !approvalRequestMessage.trim() ||
                      !editedProfile.specialization ||
                      !editedProfile.license_number ||
                      !editedProfile.department ||
                      !editedProfile.years_of_experience ||
                      (editedProfile.phone && !isPhoneValid())
                    }
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fas fa-paper-plane mr-2"></i>
                    Submit Request
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Progress Modal */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
              >
                <div className="text-center">
                  {/* Animated Upload Icon */}
                  <motion.div
                    animate={{
                      y: [0, -10, 0],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <i className="fas fa-cloud-upload-alt text-blue-600 text-4xl"></i>
                  </motion.div>

                  <h3 className="text-2xl font-bold text-gray-800 mb-2">
                    Uploading File
                  </h3>
                  <p className="text-gray-600 mb-1 truncate">
                    {uploadFileName}
                  </p>
                  <p className="text-sm text-gray-500 mb-6">Please wait...</p>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full relative overflow-hidden"
                    >
                      {/* Animated shimmer effect */}
                      <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      />
                    </motion.div>
                  </div>

                  {/* Percentage Text */}
                  <p className="text-blue-600 font-bold text-lg">
                    {uploadProgress}%
                  </p>

                  {/* Success Message (when complete) */}
                  {uploadProgress === 100 && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="mt-4 flex items-center justify-center gap-2 text-green-600"
                    >
                      <i className="fas fa-check-circle text-xl"></i>
                      <span className="font-semibold">Upload Complete!</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== PATIENT DASHBOARD ===== */}
        {currentView === "dashboard" && user?.role === "patient" && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <motion.div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <h2 className="text-2xl font-bold mb-2">
                Welcome back, {user?.name}! 👋
              </h2>
              <p className="opacity-90">
                Here's your health overview for today
              </p>
            </motion.div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Medical Records</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {records.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-file-medical text-blue-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">
                      Active Conversations
                    </p>
                    <p className="text-3xl font-bold text-green-600">
                      {conversations.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-comments text-green-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Requests</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {
                        messageRequests.filter((r) => r.status === "pending")
                          .length
                      }
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-yellow-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Health Status</p>

                    <p
                      className={`text-xl font-bold flex items-center gap-1 ${
                        healthSummary?.overall_status === "Critical"
                          ? "text-red-600"
                          : healthSummary?.overall_status === "Needs Attention"
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      <i
                        className={`fas ${
                          healthSummary?.overall_status === "Critical"
                            ? "fa-exclamation-triangle"
                            : healthSummary?.overall_status ===
                                "Needs Attention"
                              ? "fa-exclamation-circle"
                              : "fa-check-circle"
                        }`}
                      ></i>

                      {healthSummary?.overall_status || "Unknown"}
                    </p>
                  </div>

                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-heartbeat text-green-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - 2/3 width */}
              <div className="lg:col-span-2 space-y-6">
                {/* Health Summary */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                      AI Health Summary
                    </h3>

                    <button
                      onClick={() => setCurrentView("records")}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All Records →
                    </button>
                    <button
                      onClick={() => setCurrentView("timeline")}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      View Health Timeline →
                    </button>
                  </div>
                  {records.length === 0 ? (
                    <div className="text-center p-10 bg-blue-50 rounded-lg border-2 border-dashed border-blue-200">
                      <i className="fas fa-upload text-4xl text-blue-500 mb-3"></i>
                      <p className="text-gray-600 mb-2">
                        No health records found. Upload your first report:
                      </p>
                      <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition inline-block">
                        Upload File
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleUpload}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-blue-100 to-blue-50 p-6 rounded-lg">
                      <p className="text-gray-700 leading-relaxed">
                        {records.length === 0
                          ? "Upload medical records to generate health insights."
                          : healthSummary?.summary
                            ? healthSummary.summary
                            : "Analyzing medical records..."}
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* Recent Records */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-4">
                    Recent Records
                  </h3>
                  <div className="space-y-3">
                    {records.slice(0, 3).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 flex items-center justify-center rounded-lg">
                            <i className="fas fa-file-medical text-blue-600"></i>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {r.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {r.type} • {r.date}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs bg-blue-200 text-blue-700 px-3 py-1 rounded-full">
                          {r.category}
                        </span>
                      </div>
                    ))}
                    {records.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No records yet
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Sidebar - 1/3 width */}
              <div className="space-y-6">
                {/* Quick Actions */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setCurrentView("messages")}
                      className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left"
                    >
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-comments text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          Message Doctor
                        </p>
                        <p className="text-xs text-gray-600">
                          Chat with your healthcare provider
                        </p>
                      </div>
                    </button>

                    <label className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition text-left cursor-pointer">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-upload text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          Upload Record
                        </p>
                        <p className="text-xs text-gray-600">
                          Add new medical document
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                      />
                    </label>

                    <button
                      onClick={() => setCurrentView("records")}
                      className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition text-left"
                    >
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <i className="fas fa-file-medical text-white"></i>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          View Records
                        </p>
                        <p className="text-xs text-gray-600">
                          See all your health records
                        </p>
                      </div>
                    </button>

                    {isUploading && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          >
                            <i className="fas fa-spinner text-blue-600 text-xl"></i>
                          </motion.div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 truncate">
                              {uploadFileName}
                            </p>
                            <p className="text-sm text-gray-600">
                              Uploading...
                            </p>
                          </div>
                          <span className="text-blue-600 font-bold">
                            {uploadProgress}%
                          </span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                  className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-4">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {conversations.slice(0, 3).map((conv, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        <div>
                          <p className="text-gray-800">
                            Message with{" "}
                            <span className="font-semibold">
                              {conv.other_user_name}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(
                              conv.last_message_time,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    {conversations.length === 0 && (
                      <p className="text-center text-gray-500 py-4 text-sm">
                        No recent activity
                      </p>
                    )}
                  </div>
                </motion.div>

                {/* AI Health Tips */}
                <motion.div
                  className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <i className="fas fa-lightbulb text-yellow-500 text-xl"></i>
                      <h3 className="text-lg font-bold text-gray-800">
                        Daily Wellness Tips
                      </h3>
                    </div>
                    <button
                      onClick={fetchHealthTips}
                      disabled={healthTipsLoading}
                      className="text-blue-600 hover:text-blue-800 transition p-1.5 rounded-lg hover:bg-blue-100"
                      title="Get new tips"
                    >
                      <i
                        className={`fas fa-sync-alt text-sm ${healthTipsLoading ? "animate-spin" : ""}`}
                      ></i>
                    </button>
                  </div>

                  {healthTipsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <i className="fas fa-spinner fa-spin text-blue-500 text-lg mr-2"></i>
                      <span className="text-sm text-gray-500">
                        Loading tips...
                      </span>
                    </div>
                  ) : healthTips.length > 0 ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={healthTips[0]?.tip}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/70 rounded-lg p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <i
                              className={`fas ${healthTips[0]?.icon || "fa-heartbeat"} text-white text-sm`}
                            ></i>
                          </div>
                          <div className="flex-1">
                            <span className="inline-block text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-1.5">
                              {healthTips[0]?.category || "Wellness"}
                            </span>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {healthTips[0]?.tip}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-3">
                      No tips available. Click refresh to load.
                    </p>
                  )}

                  <p className="text-[10px] text-gray-400 mt-3 text-center italic">
                    💡 General wellness suggestions — not medical advice
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ADMIN DASHBOARD ===== */}
        {currentView === "dashboard" && user?.role === "admin" && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <motion.div
              className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <h2 className="text-2xl font-bold mb-2">Admin Dashboard 👨‍💼</h2>
              <p className="opacity-90">System Overview & Management</p>
            </motion.div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Total Users</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {adminStats.total_users || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-users text-purple-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Pending Requests</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {adminStats.pending_join_requests || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-yellow-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Approved Clinicians</p>
                    <p className="text-3xl font-bold text-green-600">
                      {adminStats.approved_clinicians || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-user-md text-green-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">
                      Active Conversations
                    </p>
                    <p className="text-3xl font-bold text-blue-600">
                      {adminStats.active_conversations || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-comments text-blue-600 text-xl"></i>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Admin Sub-Navigation */}
            <div className="bg-white rounded-xl p-4 shadow-md">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setAdminView("dashboard")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    adminView === "dashboard"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-chart-pie mr-2"></i>Overview
                </button>
                <button
                  onClick={() => setAdminView("requests")}
                  className={`px-4 py-2 rounded-lg font-medium transition relative ${
                    adminView === "requests"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-user-plus mr-2"></i>Join Requests
                  {adminStats.pending_join_requests > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {adminStats.pending_join_requests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setAdminView("clinicians")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    adminView === "clinicians"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-user-md mr-2"></i>Clinicians
                </button>
                <button
                  onClick={() => {
                    setAdminView("patients");
                    loadAllPatients();
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    adminView === "patients"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-user-injured mr-2"></i>Patients
                </button>
                <button
                  onClick={() => setAdminView("logs")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    adminView === "logs"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-history mr-2"></i>Audit Logs
                </button>
                <button
                  onClick={() => setAdminView("messages")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    adminView === "messages"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <i className="fas fa-comments mr-2"></i>Messages
                </button>
              </div>
            </div>

            {/* Admin Content Based on View */}
            {adminView === "dashboard" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <motion.div
                    className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <p className="text-sm text-gray-500 mb-1">
                      Active Patients
                    </p>
                    <p className="text-3xl font-bold text-emerald-600">
                      {adminPatientAnalytics.activeCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {adminPatientAnalytics.inactiveCount} inactive
                    </p>
                  </motion.div>
                  <motion.div
                    className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                  >
                    <p className="text-sm text-gray-500 mb-1">Average Age</p>
                    <p className="text-3xl font-bold text-sky-600">
                      {adminPatientAnalytics.averageAge ?? "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Based on patient profiles
                    </p>
                  </motion.div>
                  <motion.div
                    className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-sm text-gray-500 mb-1">Patient Alerts</p>
                    <p className="text-3xl font-bold text-amber-600">
                      {adminPatientAnalytics.totalAlerts}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Monitored across all patients
                    </p>
                  </motion.div>
                  <motion.div
                    className="bg-white rounded-xl p-5 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    <p className="text-sm text-gray-500 mb-1">Critical Cases</p>
                    <p className="text-3xl font-bold text-rose-600">
                      {adminPatientAnalytics.statusCounts.critical}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Needs immediate attention
                    </p>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Statistics */}
                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      System Statistics
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                        <span className="text-gray-700">Total Patients</span>
                        <span className="font-bold text-blue-600">
                          {adminStats.total_patients || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <span className="text-gray-700">Total Clinicians</span>
                        <span className="font-bold text-green-600">
                          {adminStats.total_clinicians || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                        <span className="text-gray-700">Total Messages</span>
                        <span className="font-bold text-purple-600">
                          {adminStats.total_messages || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                        <span className="text-gray-700">Medical Records</span>
                        <span className="font-bold text-orange-600">
                          {adminStats.total_records || 0}
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Patient Status Distribution */}
                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Patient Status Distribution
                    </h3>
                    <div className="space-y-4">
                      {[
                        {
                          label: "Stable",
                          count: adminPatientAnalytics.statusCounts.stable,
                          color: "bg-emerald-500",
                        },
                        {
                          label: "Attention",
                          count: adminPatientAnalytics.statusCounts.attention,
                          color: "bg-amber-500",
                        },
                        {
                          label: "Critical",
                          count: adminPatientAnalytics.statusCounts.critical,
                          color: "bg-rose-500",
                        },
                      ].map((item) => {
                        const width = allPatients.length
                          ? `${Math.max((item.count / allPatients.length) * 100, item.count ? 8 : 0)}%`
                          : "0%";
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700">
                                {item.label}
                              </span>
                              <span className="text-gray-500">
                                {item.count}
                              </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`${item.color} h-3 rounded-full transition-all duration-500`}
                                style={{ width }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100 lg:col-span-2"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-800">
                        Patient Growth
                      </h3>
                      <span className="text-sm text-gray-500">
                        Last 6 months
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-3 items-end h-56">
                      {adminPatientAnalytics.monthlyRegistrations.map(
                        (month) => (
                          <div
                            key={month.key}
                            className="flex flex-col items-center justify-end h-full"
                          >
                            <span className="text-xs text-gray-500 mb-2">
                              {month.count}
                            </span>
                            <div
                              className="w-full max-w-[56px] bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-lg"
                              style={{
                                height: `${Math.max((month.count / adminPatientAnalytics.maxMonthlyRegistrations) * 100, month.count ? 16 : 4)}%`,
                              }}
                            ></div>
                            <span className="text-xs font-medium text-gray-600 mt-2">
                              {month.label}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Blood Type Mix
                    </h3>
                    <div className="space-y-3">
                      {adminPatientAnalytics.bloodTypeDistribution.map(
                        (item) => {
                          const width = allPatients.length
                            ? `${Math.max((item.count / allPatients.length) * 100, 10)}%`
                            : "0%";
                          return (
                            <div key={item.label}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">
                                  {item.label}
                                </span>
                                <span className="text-gray-500">
                                  {item.count}
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-2.5 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                                  style={{ width }}
                                ></div>
                              </div>
                            </div>
                          );
                        },
                      )}
                      {adminPatientAnalytics.bloodTypeDistribution.length ===
                        0 && (
                        <p className="text-sm text-gray-500">
                          No blood type data available yet.
                        </p>
                      )}
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Age Groups
                    </h3>
                    <div className="space-y-3">
                      {adminPatientAnalytics.ageGroups.map((group) => {
                        const maxAgeGroupCount = Math.max(
                          ...adminPatientAnalytics.ageGroups.map(
                            (item) => item.count,
                          ),
                          1,
                        );
                        return (
                          <div key={group.label}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium text-gray-700">
                                {group.label}
                              </span>
                              <span className="text-gray-500">
                                {group.count}
                              </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"
                                style={{
                                  width: `${Math.max((group.count / maxAgeGroupCount) * 100, group.count ? 10 : 0)}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  <motion.div
                    className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Recent Patients
                    </h3>
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {adminPatientAnalytics.recentPatients.map((patient) => (
                        <div
                          key={patient.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          <div>
                            <p className="font-semibold text-gray-800">
                              {patient.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {patient.email}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Joined{" "}
                              {patient.created_at
                                ? new Date(
                                    patient.created_at,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getPatientStatusClasses(patient.status)}`}
                          >
                            {patient.status || "stable"}
                          </span>
                        </div>
                      ))}
                      {adminPatientAnalytics.recentPatients.length === 0 && (
                        <p className="text-center text-gray-500 py-4">
                          No patients found yet.
                        </p>
                      )}
                    </div>
                  </motion.div>
                </div>

                <motion.div
                  className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-4">
                    Recent Admin Actions
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {auditLogs.slice(0, 5).map((log, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 rounded-lg text-sm"
                      >
                        <p className="font-medium text-gray-800">
                          {log.action.replace(/_/g, " ").toUpperCase()}
                        </p>
                        <p className="text-gray-600 text-xs">{log.details}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {auditLogs.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No recent actions
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {adminView === "messages" && (
              <motion.div
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Admin Messages
                </h3>

                {/* Sub Navigation */}
                <div className="flex gap-2 mb-6 border-b pb-2">
                  <button
                    onClick={() => {
                      setAdminMessagingView("users");
                      setAdminSelectedConversation(null);
                      loadAdminUsers();
                    }}
                    className={`px-4 py-2 font-medium transition ${
                      adminMessagingView === "users"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-purple-600"
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => {
                      setAdminMessagingView("conversations");
                      setAdminSelectedConversation(null);
                      loadAdminConversations();
                    }}
                    className={`px-4 py-2 font-medium transition ${
                      adminMessagingView === "conversations"
                        ? "border-b-2 border-purple-600 text-purple-600"
                        : "text-gray-600 hover:text-purple-600"
                    }`}
                  >
                    Conversations ({adminConversations.length})
                  </button>
                </div>

                {/* All Users List */}
                {adminMessagingView === "users" &&
                  !adminSelectedConversation && (
                    <div className="grid md:grid-cols-2 gap-3">
                      {adminUsers.map((u) => (
                        <div
                          key={u.email}
                          onClick={() => {
                            setAdminSelectedConversation({
                              other_user_email: u.email,
                              other_user_name: u.name,
                              other_user_role: u.role,
                            });
                            loadAdminMessages(u.email);
                          }}
                          className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition border border-gray-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  u.role === "patient"
                                    ? "bg-blue-100"
                                    : "bg-green-100"
                                }`}
                              >
                                <i
                                  className={`fas ${u.role === "patient" ? "fa-user" : "fa-user-md"} ${
                                    u.role === "patient"
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }`}
                                ></i>
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800">
                                  {u.name}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {u.additional_info}
                                </p>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    u.status === "approved"
                                      ? "bg-green-100 text-green-700"
                                      : u.status === "pending"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-blue-100 text-blue-700"
                                  }`}
                                >
                                  {u.role} - {u.status}
                                </span>
                              </div>
                            </div>
                            <i className="fas fa-chevron-right text-gray-400"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Conversations List */}
                {adminMessagingView === "conversations" &&
                  !adminSelectedConversation && (
                    <div className="space-y-3">
                      {adminConversations.map((conv) => (
                        <div
                          key={conv.other_user_email}
                          onClick={() => {
                            setAdminSelectedConversation(conv);
                            loadAdminMessages(conv.other_user_email);
                          }}
                          className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 cursor-pointer transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                              <i
                                className={`fas ${conv.other_user_role === "patient" ? "fa-user" : "fa-user-md"} text-purple-600 text-xl`}
                              ></i>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-800">
                                {conv.other_user_name}
                              </h3>
                              <p className="text-sm text-gray-600 truncate max-w-xs">
                                {conv.last_message}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(
                                  conv.last_message_time,
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <i className="fas fa-chevron-right text-gray-400"></i>
                        </div>
                      ))}
                      {adminConversations.length === 0 && (
                        <p className="text-center text-gray-500 py-8">
                          No conversations yet
                        </p>
                      )}
                    </div>
                  )}

                {/* Chat View */}
                {adminSelectedConversation && (
                  <div className="flex flex-col h-96">
                    {/* Chat Header */}
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAdminSelectedConversation(null)}
                          className="text-gray-600 hover:text-purple-600"
                        >
                          <i className="fas fa-arrow-left"></i>
                        </button>
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <i
                            className={`fas ${adminSelectedConversation.other_user_role === "patient" ? "fa-user" : "fa-user-md"} text-purple-600`}
                          ></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            {adminSelectedConversation.other_user_name}
                          </h3>
                          <p className="text-xs text-gray-500 capitalize">
                            {adminSelectedConversation.other_user_role}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div
                      ref={adminConversationScrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-3"
                    >
                      {adminMessages.map((msg, index) => {
                        const currentDate = formatMessageDate(msg.sent_at);
                        const prevDate =
                          index > 0
                            ? formatMessageDate(
                                adminMessages[index - 1].sent_at,
                              )
                            : null;
                        const showDateDivider = prevDate !== currentDate;

                        const isEditing = editingMessageId === msg.id;

                        return (
                          <div key={msg.id}>
                            {/* 📅 Date Divider */}
                            {showDateDivider && (
                              <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-gray-300"></div>
                                <span className="text-xs text-gray-500 font-medium">
                                  {currentDate}
                                </span>
                                <div className="flex-1 h-px bg-gray-300"></div>
                              </div>
                            )}

                            {/* 💬 Message Row */}
                            <div
                              className={`flex ${
                                msg.is_mine ? "justify-end" : "justify-start"
                              }`}
                            >
                              {/* 💬 Message Bubble */}
                              <div
                                className={`max-w-xs px-4 py-2 rounded-lg ${
                                  msg.is_mine
                                    ? "bg-purple-600 text-white"
                                    : "bg-gray-200 text-gray-800"
                                }`}
                              >
                                {isEditing ? (
                                  // ✏️ EDIT MODE
                                  <div className="space-y-2">
                                    <textarea
                                      value={editingMessageText}
                                      onChange={(e) =>
                                        setEditingMessageText(e.target.value)
                                      }
                                      className="w-full rounded bg-white text-gray-800 px-2 py-1 text-sm"
                                      rows={2}
                                    />

                                    <div className="flex gap-2 text-xs">
                                      <button
                                        onClick={cancelEditingMessage}
                                        className="px-2 py-1 bg-gray-300 rounded"
                                      >
                                        Cancel
                                      </button>

                                      <button
                                        onClick={saveEditedMessage}
                                        className="px-2 py-1 bg-green-500 text-white rounded"
                                      >
                                        {isSaving ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // 💬 NORMAL MODE
                                  <div>
                                    {/* 📝 Message */}
                                    <p className="break-words">{msg.message}</p>

                                    {/* ⏰ Time + edited */}
                                    <p className="text-xs opacity-70 mt-1 flex flex-wrap items-center gap-x-2">
                                      <span>
                                        {new Date(
                                          msg.sent_at,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      {msg.is_edited && (
                                        <span className="italic font-medium">
                                          Edited
                                        </span>
                                      )}
                                    </p>

                                    {/* ✏️🗑️ Buttons */}
                                    {msg.sender_email === user?.email && (
                                      <div className="flex gap-2 mt-1 text-xs">
                                        <button
                                          onClick={() =>
                                            startEditingMessage(msg)
                                          }
                                          className="hover:opacity-80"
                                        >
                                          ✏️
                                        </button>

                                        <button
                                          onClick={() =>
                                            handleDeleteMessage(msg.id)
                                          }
                                          className="hover:opacity-80"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Message Input */}
                    <div className="flex gap-2 pt-3 border-t">
                      <input
                        type="text"
                        value={adminNewMessage}
                        onChange={(e) => setAdminNewMessage(e.target.value)}
                        onKeyPress={(e) =>
                          e.key === "Enter" && handleAdminSendMessage()
                        }
                        placeholder="Type a message..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none"
                      />
                      <button
                        onClick={handleAdminSendMessage}
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
                      >
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {adminView === "requests" && (
              <motion.div
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Clinician Join Requests
                </h3>
                <div className="space-y-4">
                  {clinicianRequests.map((req) => (
                    <div
                      key={req.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800">
                            {req.name}
                          </h4>
                          <p className="text-sm text-gray-600">{req.email}</p>
                          <p className="text-sm text-gray-500">{req.phone}</p>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          {req.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-blue-50 p-3 rounded">
                          <p className="text-xs text-gray-600">
                            Specialization
                          </p>
                          <p className="font-medium text-gray-800">
                            {req.specialization}
                          </p>
                        </div>
                        <div className="bg-green-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Experience</p>
                          <p className="font-medium text-gray-800">
                            {req.years_of_experience} years
                          </p>
                        </div>
                        <div className="bg-purple-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Department</p>
                          <p className="font-medium text-gray-800">
                            {req.department || "N/A"}
                          </p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="text-xs text-gray-600">License #</p>
                          <p className="font-medium text-gray-800">
                            {req.license_number}
                          </p>
                        </div>
                      </div>

                      {req.message && (
                        <div className="bg-gray-50 p-3 rounded mb-3">
                          <p className="text-xs text-gray-600 mb-1">Message</p>
                          <p className="text-sm text-gray-800">{req.message}</p>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mb-3">
                        Requested: {new Date(req.requested_at).toLocaleString()}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveClinicianRequest(req.id)}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium"
                        >
                          <i className="fas fa-check mr-2"></i>Approve
                        </button>
                        <button
                          onClick={() => handleRejectClinicianRequest(req.id)}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-medium"
                        >
                          <i className="fas fa-times mr-2"></i>Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {clinicianRequests.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <i className="fas fa-inbox text-4xl mb-3"></i>
                      <p>No pending requests</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {adminView === "clinicians" && (
              <motion.div
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">
                    All Clinicians
                  </h3>

                  <div className="relative w-72">
                    <input
                      type="text"
                      value={clinicianSearch}
                      onChange={(e) => setClinicianSearch(e.target.value)}
                      placeholder="Search by specialization..."
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Specialization
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Approval
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredClinicians.map((clinician) => (
                        <tr key={clinician.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {clinician.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {clinician.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {clinician.specialization}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                clinician.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {clinician.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                clinician.approval_status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : clinician.approval_status === "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {clinician.approval_status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleToggleClinicianStatus(clinician.id)
                                }
                                className={`px-3 py-1 rounded text-xs font-medium transition ${
                                  clinician.is_active
                                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-green-100 text-green-700 hover:bg-green-200"
                                }`}
                              >
                                {clinician.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                              <button
                                onClick={() =>
                                  openAdminUserActionModal(
                                    clinician.is_active
                                      ? "deactivate"
                                      : "restore",
                                    "clinician",
                                    clinician.id,
                                    clinician.name,
                                  )
                                }
                                className={`px-3 py-1 rounded text-xs font-medium transition ${
                                  clinician.is_active
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "bg-green-600 text-white hover:bg-green-700"
                                }`}
                              >
                                {clinician.is_active ? "Deactivate" : "Restore"}
                              </button>
                              <button
                                onClick={() =>
                                  openAdminUserActionModal(
                                    "delete",
                                    "clinician",
                                    clinician.id,
                                    clinician.name,
                                  )
                                }
                                className="px-3 py-1 rounded text-xs font-medium transition bg-rose-700 text-white hover:bg-rose-800"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredClinicians.length === 0 && (
                        <tr>
                          <td
                            colSpan="6"
                            className="text-center py-6 text-gray-500"
                          >
                            No clinicians found for this specialization.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {allClinicians.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p>No clinicians found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {adminView === "patients" && (
              <motion.div
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      All Patients
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Search, monitor, and review patient trends
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={adminPatientSearch}
                      onChange={(e) => setAdminPatientSearch(e.target.value)}
                      placeholder="Search by name, email, phone, blood type..."
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none min-w-[280px]"
                    />
                    <select
                      value={adminPatientStatusFilter}
                      onChange={(e) =>
                        setAdminPatientStatusFilter(e.target.value)
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="stable">Stable</option>
                      <option value="attention">Attention</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
                      Visible Patients
                    </p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {adminVisiblePatients.length}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                      Active Accounts
                    </p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {
                        adminVisiblePatients.filter(
                          (patient) => patient.is_active,
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">
                      Need Attention
                    </p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {
                        adminVisiblePatients.filter(
                          (patient) => patient.status === "attention",
                        ).length
                      }
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
                    <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">
                      Critical Cases
                    </p>
                    <p className="text-2xl font-bold text-rose-900 mt-1">
                      {
                        adminVisiblePatients.filter(
                          (patient) => patient.status === "critical",
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Age
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Blood Type
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Alerts
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Records
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Connected Clinicians
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Last Visit
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Account
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {adminVisiblePatients.map((patient) => (
                        <tr key={patient.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {patient.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.age || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.blood_type || "—"}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getPatientStatusClasses(patient.status)}`}
                            >
                              {patient.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.alerts || 0}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.records_count || 0}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.connected_clinicians || 0}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            {patient.last_visit
                              ? new Date(
                                  patient.last_visit,
                                ).toLocaleDateString()
                              : "No visits"}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                patient.is_active
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {patient.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setClinicalProfileTarget({
                                    id: patient.id,
                                    email: patient.email,
                                    name: patient.name,
                                  })
                                }
                                className="px-3 py-1 rounded text-xs font-medium transition bg-blue-700 text-white hover:bg-blue-800"
                              >
                                Profile & Stats
                              </button>
                              <button
                                onClick={() =>
                                  openAdminUserActionModal(
                                    patient.is_active
                                      ? "deactivate"
                                      : "restore",
                                    "patient",
                                    patient.id,
                                    patient.name,
                                  )
                                }
                                className={`px-3 py-1 rounded text-xs font-medium transition ${
                                  patient.is_active
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "bg-green-600 text-white hover:bg-green-700"
                                }`}
                              >
                                {patient.is_active ? "Deactivate" : "Restore"}
                              </button>
                              <button
                                onClick={() =>
                                  openAdminUserActionModal(
                                    "delete",
                                    "patient",
                                    patient.id,
                                    patient.name,
                                  )
                                }
                                className="px-3 py-1 rounded text-xs font-medium transition bg-rose-700 text-white hover:bg-rose-800"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {adminVisiblePatients.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      No patients match the current filters
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {adminView === "logs" && (
              <motion.div
                className="bg-white rounded-xl p-6 shadow-md border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Audit Logs
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {log.action.replace(/_/g, " ").toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {log.details}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            By: {log.admin_email} | Target: {log.target_email}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p>No audit logs found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ===== MESSAGES SECTION (PATIENT) ===== */}
        {currentView === "messages" && user?.role === "patient" && (
          <motion.div
            className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Messages</h2>

            {/* Sub Navigation */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => {
                  setMessagingView("browse");
                  setSelectedConversation(null);
                }}
                className={`px-4 py-2 font-medium transition ${
                  messagingView === "browse"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Browse Clinicians
              </button>
              <button
                onClick={() => {
                  setMessagingView("requests");
                  setSelectedConversation(null);
                }}
                className={`px-4 py-2 font-medium transition ${
                  messagingView === "requests"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                My Requests ({messageRequests.length})
              </button>
              <button
                onClick={() => {
                  setMessagingView("conversations");
                  setSelectedConversation(null);
                }}
                className={`px-4 py-2 font-medium transition ${
                  messagingView === "conversations"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Conversations ({conversations.length})
              </button>
            </div>

            {/* Browse Clinicians */}
            {messagingView === "browse" && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinicians.map((c) => {
                  const hasRequest = messageRequests.find(
                    (r) => r.clinician_email === c.email,
                  );
                  const isConnected = conversations.find(
                    (conv) => conv.other_user_email === c.email,
                  );

                  return (
                    <motion.div
                      key={c.id}
                      className="p-4 bg-gradient-to-br from-blue-50 to-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                      whileHover={{ scale: 1.03 }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user-md text-blue-600 text-xl"></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            {c.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {c.specialization}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {c.department}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        {c.years_of_experience} yrs experience
                      </p>

                      {isConnected ? (
                        <button
                          onClick={() => {
                            setSelectedConversation(isConnected);
                            setMessagingView("conversations");
                            loadConversationMessages(c.email);
                          }}
                          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                        >
                          <i className="fas fa-comments mr-2"></i>Chat
                        </button>
                      ) : hasRequest ? (
                        <button
                          disabled
                          className="w-full bg-gray-300 text-gray-600 py-2 rounded-lg cursor-not-allowed"
                        >
                          {hasRequest.status === "pending"
                            ? "Request Pending"
                            : hasRequest.status === "rejected"
                              ? "Request Rejected"
                              : "Connected"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRequestMessage(c.email)}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          <i className="fas fa-envelope mr-2"></i>Request to
                          Message
                        </button>
                      )}
                    </motion.div>
                  );
                })}
                {clinicians.length === 0 && (
                  <div className="col-span-3 text-center text-gray-500 py-8">
                    No clinicians found.
                  </div>
                )}
              </div>
            )}

            {/* My Requests */}
            {messagingView === "requests" && (
              <div className="space-y-3">
                {messageRequests.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No requests yet. Browse clinicians to send a request.
                  </p>
                ) : (
                  messageRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {req.clinician_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {req.clinician_specialization}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested:{" "}
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          req.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : req.status === "accepted"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Conversations List */}
            {messagingView === "conversations" && !selectedConversation && (
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No active conversations yet.
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.conversation_id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        loadConversationMessages(conv.other_user_email);
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.conversation_id === conv.conversation_id
                              ? { ...c, unread_count: 0 }
                              : c,
                          ),
                        );
                      }}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${
                        conv.unread_count > 0
                          ? "bg-blue-100 border-blue-300"
                          : "bg-blue-50 border-blue-100 hover:bg-blue-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-user-md text-blue-600 text-xl"></i>
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {conv.unread_count > 9 ? "9+" : conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3
                            className={`text-gray-800 ${conv.unread_count > 0 ? "font-bold" : "font-semibold"}`}
                          >
                            {conv.other_user_name}
                          </h3>
                          <p
                            className={`text-sm truncate max-w-xs ${conv.unread_count > 0 ? "text-gray-900 font-medium" : "text-gray-600"}`}
                          >
                            {conv.last_message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {conv.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {conv.unread_count} new
                          </span>
                        )}
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Chat View - PATIENT */}
            {messagingView === "conversations" && selectedConversation && (
              <div className="flex flex-col h-96">
                {/* Chat Header */}
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="text-gray-600 hover:text-blue-600"
                    >
                      <i className="fas fa-arrow-left"></i>
                    </button>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-user-md text-blue-600"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {selectedConversation.other_user_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.other_user_email}
                      </p>
                    </div>
                  </div>

                  {/* Schedule Meeting Button */}
                  <a
                    href={`https://comm360.feeltiptop.com/?email=${selectedConversation.other_user_email}&name=${encodeURIComponent(selectedConversation.other_user_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                  >
                    <i className="fas fa-calendar-alt"></i>
                    Schedule Meeting
                  </a>
                </div>

                {/* Messages */}
                <div
                  ref={conversationScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {conversationMessages.map((msg, index) => {
                    const currentDate = formatMessageDate(msg.sent_at);
                    const prevDate =
                      index > 0
                        ? formatMessageDate(
                            conversationMessages[index - 1].sent_at,
                          )
                        : null;
                    const showDateDivider = prevDate !== currentDate;
                    const isEditing = editingMessageId === msg.id;
                    const showTextActions =
                      msg.is_mine && !msg.attachment && !isEditing;
                    const showAttachmentDelete =
                      msg.is_mine && !!msg.attachment && !isEditing;

                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-300"></div>
                            <span className="text-xs text-gray-500 font-medium">
                              {currentDate}
                            </span>
                            <div className="flex-1 h-px bg-gray-300"></div>
                          </div>
                        )}
                        <div
                          className={`flex ${
                            msg.is_mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.is_mine
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-800"
                            }`}
                          >
                            {msg.attachment ? (
                              <div className="mb-2">
                                {showAttachmentDelete && (
                                  <div className="flex justify-end mb-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                      className="text-white/90 hover:text-white text-xs"
                                      title="Delete file"
                                    >
                                      <i className="fas fa-trash" />
                                    </button>
                                  </div>
                                )}
                                {msg.attachment.file_type === "image" ? (
                                  <img
                                    src={`/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`}
                                    alt={msg.attachment.file_name}
                                    className="max-w-full max-h-48 rounded cursor-pointer hover:opacity-90 transition"
                                    onClick={() =>
                                      window.open(
                                        `/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`,
                                        "_blank",
                                      )
                                    }
                                  />
                                ) : (
                                  <a
                                    href={`/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded ${
                                      msg.is_mine
                                        ? "bg-blue-700"
                                        : "bg-gray-300"
                                    } hover:opacity-80 transition`}
                                  >
                                    <i
                                      className={`fas ${
                                        msg.attachment.file_type === "pdf"
                                          ? "fa-file-pdf text-red-500"
                                          : "fa-file text-gray-600"
                                      }`}
                                    ></i>
                                    <span className="text-sm truncate max-w-[150px]">
                                      {msg.attachment.file_name}
                                    </span>
                                    <i className="fas fa-download text-xs ml-auto"></i>
                                  </a>
                                )}
                              </div>
                            ) : null}
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingMessageText}
                                  onChange={(e) =>
                                    setEditingMessageText(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditedMessage();
                                    if (e.key === "Escape")
                                      cancelEditingMessage();
                                  }}
                                  className="w-full rounded bg-white text-gray-800 px-2 py-1 text-sm"
                                />
                                <div className="flex justify-end gap-2 text-xs mt-1">
                                  <button
                                    type="button"
                                    onClick={cancelEditingMessage}
                                    className="px-2 py-1 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditedMessage}
                                    disabled={isSaving}
                                    className="px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                                  >
                                    {isSaving ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                {msg.prescription && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCurrentView("prescriptions")
                                    }
                                    className={`mb-2 w-full rounded-lg p-3 text-left ${msg.is_mine ? "bg-blue-700" : "bg-white border border-emerald-200"}`}
                                  >
                                    <span className="block text-xs font-semibold uppercase tracking-wide">
                                      Prescription #{msg.prescription.id}
                                    </span>
                                    <span className="mt-1 block font-semibold">
                                      {(msg.prescription.medicines || [])
                                        .map(
                                          (medicine) => medicine.medicine_name,
                                        )
                                        .join(", ")}
                                    </span>
                                    <span className="mt-1 block text-xs opacity-80">
                                      Status: {msg.prescription.status} · Open
                                      prescription details
                                    </span>
                                  </button>
                                )}
                                {msg.message && (
                                  <p className="flex-1 break-words">
                                    {msg.message}
                                  </p>
                                )}
                                {showTextActions && (
                                  <div className="flex items-center gap-2 text-xs ml-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => startEditingMessage(msg)}
                                      className="text-white/90 hover:text-white"
                                      title="Edit"
                                    >
                                      <i className="fas fa-pen" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                      className="text-white/90 hover:text-white"
                                      title="Delete"
                                    >
                                      <i className="fas fa-trash" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-xs opacity-70 mt-1 text-right flex flex-wrap items-center justify-end gap-x-2">
                              <span>
                                {new Date(msg.sent_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {msg.is_edited && (
                                <span className="italic font-medium">
                                  Edited
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message Input with Upload */}
                <div className="flex gap-2 pt-3 border-t">
                  {/* File Upload Button */}
                  <label className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                    <i className="fas fa-paperclip text-gray-600"></i>
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        await handleChatAttachmentUpload(
                          file,
                          selectedConversation,
                        );
                        e.target.value = "";
                      }}
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                  </label>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ===== MESSAGES SECTION (CLINICIAN) ===== */}
        {currentView === "messages" && user?.role === "clinician" && (
          <motion.div
            className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Messages</h2>

            {/* Sub Navigation */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => {
                  setMessagingView("requests");
                  setSelectedConversation(null);
                }}
                className={`px-4 py-2 font-medium transition ${
                  messagingView === "requests"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                Pending Requests ({messageRequests.length})
              </button>
              <button
                onClick={() => {
                  setMessagingView("conversations");
                  setSelectedConversation(null);
                }}
                className={`px-4 py-2 font-medium transition ${
                  messagingView === "conversations"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-blue-600"
                }`}
              >
                My Patients ({conversations.length})
              </button>
            </div>

            {/* Pending Requests */}
            {messagingView === "requests" && (
              <div className="space-y-3">
                {messageRequests.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No pending requests.
                  </p>
                ) : (
                  messageRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-100"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {req.patient_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {req.patient_email}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested:{" "}
                          {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Conversations */}
            {messagingView === "conversations" && !selectedConversation && (
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No patient conversations yet.
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.conversation_id}
                      onClick={() => {
                        setSelectedConversation(conv);
                        loadConversationMessages(conv.other_user_email);
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.conversation_id === conv.conversation_id
                              ? { ...c, unread_count: 0 }
                              : c,
                          ),
                        );
                      }}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${
                        conv.unread_count > 0
                          ? "bg-blue-100 border-blue-300"
                          : "bg-blue-50 border-blue-100 hover:bg-blue-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <i className="fas fa-user text-blue-600 text-xl"></i>
                          </div>
                          {conv.unread_count > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                              {conv.unread_count > 9 ? "9+" : conv.unread_count}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3
                            className={`text-gray-800 ${conv.unread_count > 0 ? "font-bold" : "font-semibold"}`}
                          >
                            {conv.other_user_name}
                          </h3>
                          <p
                            className={`text-sm truncate max-w-xs ${conv.unread_count > 0 ? "text-gray-900 font-medium" : "text-gray-600"}`}
                          >
                            {conv.last_message}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {conv.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            {conv.unread_count} new
                          </span>
                        )}
                        <i className="fas fa-chevron-right text-gray-400"></i>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Chat View - CLINICIAN */}
            {messagingView === "conversations" && selectedConversation && (
              <div className="flex flex-col h-96">
                {/* Chat Header */}
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="text-gray-600 hover:text-blue-600"
                    >
                      <i className="fas fa-arrow-left"></i>
                    </button>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-user text-blue-600"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {selectedConversation.other_user_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedConversation.other_user_email}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setClinicalProfileTarget({
                          email: selectedConversation.other_user_email,
                          name: selectedConversation.other_user_name,
                        })
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      <i className="fas fa-user"></i>
                      Patient Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrescriptionPatientEmail(
                          selectedConversation.other_user_email,
                        );
                        setCurrentView("prescriptions");
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                    >
                      <i className="fas fa-prescription"></i>
                      Create Prescription
                    </button>
                    {/* Schedule Meeting Button */}
                    <a
                      href={`https://comm360.feeltiptop.com/?email=${selectedConversation.other_user_email}&name=${encodeURIComponent(selectedConversation.other_user_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                    >
                      <i className="fas fa-calendar-alt"></i>
                      Schedule Meeting
                    </a>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={conversationScrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {conversationMessages.map((msg, index) => {
                    const currentDate = formatMessageDate(msg.sent_at);
                    const prevDate =
                      index > 0
                        ? formatMessageDate(
                            conversationMessages[index - 1].sent_at,
                          )
                        : null;
                    const showDateDivider = prevDate !== currentDate;
                    const isEditing = editingMessageId === msg.id;
                    const showTextActions =
                      msg.is_mine && !msg.attachment && !isEditing;
                    const showAttachmentDelete =
                      msg.is_mine && !!msg.attachment && !isEditing;

                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-gray-300"></div>
                            <span className="text-xs text-gray-500 font-medium">
                              {currentDate}
                            </span>
                            <div className="flex-1 h-px bg-gray-300"></div>
                          </div>
                        )}
                        <div
                          className={`flex ${
                            msg.is_mine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.is_mine
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-800"
                            }`}
                          >
                            {msg.attachment ? (
                              <div className="mb-2">
                                {showAttachmentDelete && (
                                  <div className="flex justify-end mb-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                      className="text-white/90 hover:text-white text-xs"
                                      title="Delete file"
                                    >
                                      <i className="fas fa-trash" />
                                    </button>
                                  </div>
                                )}
                                {msg.attachment.file_type === "image" ? (
                                  <img
                                    src={`/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`}
                                    alt={msg.attachment.file_name}
                                    className="max-w-full max-h-48 rounded cursor-pointer hover:opacity-90 transition"
                                    onClick={() =>
                                      window.open(
                                        `/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`,
                                        "_blank",
                                      )
                                    }
                                  />
                                ) : (
                                  <a
                                    href={`/api/chat/download/${msg.attachment.id}?token=${localStorage.getItem("access_token")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded ${
                                      msg.is_mine
                                        ? "bg-blue-700"
                                        : "bg-gray-300"
                                    } hover:opacity-80 transition`}
                                  >
                                    <i
                                      className={`fas ${
                                        msg.attachment.file_type === "pdf"
                                          ? "fa-file-pdf text-red-500"
                                          : "fa-file text-gray-600"
                                      }`}
                                    ></i>
                                    <span className="text-sm truncate max-w-[150px]">
                                      {msg.attachment.file_name}
                                    </span>
                                    <i className="fas fa-download text-xs ml-auto"></i>
                                  </a>
                                )}
                              </div>
                            ) : null}
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingMessageText}
                                  onChange={(e) =>
                                    setEditingMessageText(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditedMessage();
                                    if (e.key === "Escape")
                                      cancelEditingMessage();
                                  }}
                                  className="w-full rounded bg-white text-gray-800 px-2 py-1 text-sm"
                                />
                                <div className="flex justify-end gap-2 text-xs mt-1">
                                  <button
                                    type="button"
                                    onClick={cancelEditingMessage}
                                    className="px-2 py-1 rounded bg-gray-300 text-gray-800 hover:bg-gray-400"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveEditedMessage}
                                    disabled={isSaving}
                                    className="px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                                  >
                                    {isSaving ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                {msg.prescription && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCurrentView("prescriptions")
                                    }
                                    className={`mb-2 w-full rounded-lg p-3 text-left ${msg.is_mine ? "bg-blue-700" : "bg-white border border-emerald-200"}`}
                                  >
                                    <span className="block text-xs font-semibold uppercase tracking-wide">
                                      Prescription #{msg.prescription.id}
                                    </span>
                                    <span className="mt-1 block font-semibold">
                                      {(msg.prescription.medicines || [])
                                        .map(
                                          (medicine) => medicine.medicine_name,
                                        )
                                        .join(", ")}
                                    </span>
                                    <span className="mt-1 block text-xs opacity-80">
                                      Status: {msg.prescription.status} · Open
                                      prescription details
                                    </span>
                                  </button>
                                )}
                                {msg.message && (
                                  <p className="flex-1 break-words">
                                    {msg.message}
                                  </p>
                                )}
                                {showTextActions && (
                                  <div className="flex items-center gap-2 text-xs ml-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => startEditingMessage(msg)}
                                      className="text-white/90 hover:text-white"
                                      title="Edit"
                                    >
                                      <i className="fas fa-pen" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteMessage(msg.id)
                                      }
                                      className="text-white/90 hover:text-white"
                                      title="Delete"
                                    >
                                      <i className="fas fa-trash" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="text-xs opacity-70 mt-1 text-right flex flex-wrap items-center justify-end gap-x-2">
                              <span>
                                {new Date(msg.sent_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {msg.is_edited && (
                                <span className="italic font-medium">
                                  Edited
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message Input with Upload */}
                <div className="flex gap-2 pt-3 border-t">
                  {/* File Upload Button */}
                  <label className="cursor-pointer flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                    <i className="fas fa-paperclip text-gray-600"></i>
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        await handleChatAttachmentUpload(
                          file,
                          selectedConversation,
                        );
                        e.target.value = "";
                      }}
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                  </label>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
        {user?.role !== "admin" && currentView === "appointments" && (
          <Appointments user={user} />
        )}
        {user?.role !== "admin" && currentView === "prescriptions" && (
          <Prescriptions
            user={user}
            initialPatientEmail={prescriptionPatientEmail}
          />
        )}

        {currentView === "meal-planner" && user?.role === "patient" && (
          <Suspense
            fallback={
              <div className="py-16 text-center text-gray-500">
                Loading Meal Planner...
              </div>
            }
          >
            <MealPlanner careConnectUser={user} />
          </Suspense>
        )}

        {currentView === "timeline" && user?.role === "patient" && (
          <PatientHealthTimeline />
        )}

        {currentView === "emergency-alerts" && ["patient","admin", "clinician"].includes(user?.role) && (
  <EmergencyAlerts user={user} />
)}

        {/* ===== RECORDS SECTION ===== */}

        {/* ENHANCED RECORDS SECTION */}
        {currentView === "records" && (
          <motion.div
            className="bg-white shadow-lg rounded-xl p-6 border border-gray-100"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Medical Records
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {records.length} record{records.length !== 1 ? "s" : ""}{" "}
                  uploaded
                </p>
              </div>

              <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                <i className="fas fa-upload"></i> Upload Record
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.xls,.xlsx"
                  onChange={handleUpload}
                />
              </label>
            </div>

            <AIReportComparison records={records} />

            {records.length === 0 ? (
              <div className="text-center py-12 bg-blue-50 rounded-lg border-2 border-dashed border-blue-200">
                <i className="fas fa-file-medical text-5xl text-blue-400 mb-4"></i>
                <p className="text-gray-600 mb-4">No medical records found</p>
                <p className="text-sm text-gray-500 mb-4">
                  Upload your lab results, prescriptions, or medical reports to
                  get AI-powered insights
                </p>
                <label className="cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2">
                  <i className="fas fa-upload"></i>
                  Upload Your First Record
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.xls,.xlsx"
                    onChange={handleUpload}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <motion.div
                    key={record.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer bg-gradient-to-r from-white to-blue-50"
                    whileHover={{ scale: 1.01 }}
                    onClick={() => loadRecordDetails(record.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className="fas fa-file-medical text-blue-600 text-xl"></i>
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">
                            {record.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <i className="fas fa-folder text-xs"></i>
                              {record.type}
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="fas fa-calendar text-xs"></i>
                              {record.date}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                record.category === "Lab Results"
                                  ? "bg-purple-100 text-purple-700"
                                  : record.category === "Prescription"
                                    ? "bg-green-100 text-green-700"
                                    : record.category === "Medical Report"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {record.category}
                            </span>
                          </div>

                          {record.analysis_summary && (
                            <div className="bg-white border border-blue-100 rounded p-2 mb-2">
                              <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <i className="fas fa-robot text-blue-600"></i>
                                AI Analysis
                              </p>
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {record.analysis_summary}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs">
                            {record.has_metrics && (
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                <i className="fas fa-chart-line"></i>
                                Metrics Extracted
                              </span>
                            )}
                            {record.findings_count > 0 && (
                              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full flex items-center gap-1">
                                <i className="fas fa-exclamation-circle"></i>
                                {record.findings_count} Finding
                                {record.findings_count !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openVersionHistory(record);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold"
                        >
                          <i className="fas fa-code-branch mr-1"></i>
                          Versions
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // 🔥 REQUIRED
                            handleDeleteRecord(record.id);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-semibold"
                        >
                          🗑️ Delete
                        </button>
                      </div>

                      <i className="fas fa-chevron-right text-gray-400 mt-3"></i>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* RECORD DETAILS MODAL */}
        <AnimatePresence>
          {showRecordModal && recordDetails && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">
                        {recordDetails.name}
                      </h2>
                      <p className="text-sm opacity-90">
                        {recordDetails.type} • {recordDetails.category} •{" "}
                        {new Date(
                          recordDetails.uploaded_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRecordModal(false)}
                      className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {recordDetails.analysis?.summary && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <i className="fas fa-robot text-blue-600 text-xl"></i>
                        <h3 className="font-semibold text-gray-800">
                          AI-Generated Summary
                        </h3>
                      </div>
                      <p className="text-gray-700 leading-relaxed">
                        {recordDetails.analysis.summary}
                      </p>
                    </div>
                  )}

                  {recordDetails.analysis?.metrics &&
                    Object.keys(recordDetails.analysis.metrics).some(
                      (key) =>
                        recordDetails.analysis.metrics[key] &&
                        recordDetails.analysis.metrics[key].length > 0,
                    ) && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-chart-line text-green-600"></i>
                          Extracted Health Metrics
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          {recordDetails.analysis.metrics.blood_pressure
                            ?.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">
                                Blood Pressure
                              </p>
                              {recordDetails.analysis.metrics.blood_pressure.map(
                                (bp, idx) => (
                                  <p
                                    key={idx}
                                    className="font-semibold text-red-700"
                                  >
                                    {bp[0]}/{bp[1]} mmHg
                                  </p>
                                ),
                              )}
                            </div>
                          )}
                          {recordDetails.analysis.metrics.heart_rate?.length >
                            0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">
                                Heart Rate
                              </p>
                              {recordDetails.analysis.metrics.heart_rate.map(
                                (hr, idx) => (
                                  <p
                                    key={idx}
                                    className="font-semibold text-blue-700"
                                  >
                                    {hr} bpm
                                  </p>
                                ),
                              )}
                            </div>
                          )}
                          {recordDetails.analysis.metrics.temperature?.length >
                            0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">
                                Temperature
                              </p>
                              {recordDetails.analysis.metrics.temperature.map(
                                (temp, idx) => (
                                  <p
                                    key={idx}
                                    className="font-semibold text-orange-700"
                                  >
                                    {temp}
                                  </p>
                                ),
                              )}
                            </div>
                          )}
                          {recordDetails.analysis.metrics.blood_sugar?.length >
                            0 && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                              <p className="text-xs text-gray-600 mb-1">
                                Blood Sugar
                              </p>
                              {recordDetails.analysis.metrics.blood_sugar.map(
                                (sugar, idx) => (
                                  <p
                                    key={idx}
                                    className="font-semibold text-purple-700"
                                  >
                                    {sugar} mg/dL
                                  </p>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {recordDetails.analysis?.key_findings &&
                    recordDetails.analysis.key_findings.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="fas fa-clipboard-list text-orange-600"></i>
                          Key Findings
                        </h3>
                        <div className="space-y-2">
                          {recordDetails.analysis.key_findings.map(
                            (finding, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded p-3"
                              >
                                <i className="fas fa-check-circle text-orange-600 mt-1"></i>
                                <p className="text-sm text-gray-700 flex-1">
                                  {finding}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {recordDetails.analysis?.extracted_text_preview && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <i className="fas fa-file-alt text-gray-600"></i>
                        Document Preview
                      </h3>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                        <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">
                          {recordDetails.analysis.extracted_text_preview}...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t flex justify-end gap-3">
                  <button
                    onClick={() => setShowRecordModal(false)}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>

      {user?.role === "patient" && currentView !== "meal-planner" && (
        <HealthChatbot user={user} />
      )}
      {showVersionHistory && versionRecord && (
        <RecordVersionHistory
          record={versionRecord}
          onClose={() => {
            setShowVersionHistory(false);
            setVersionRecord(null);
          }}
          onVersionUploaded={loadData}
        />
      )}
      {clinicalProfileTarget && (
        <PatientClinicalProfile
          patientEmail={clinicalProfileTarget.email}
          patientId={clinicalProfileTarget.id}
          canEdit={user?.role === "admin"}
          onUpdated={loadAllPatients}
          onClose={() => setClinicalProfileTarget(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
