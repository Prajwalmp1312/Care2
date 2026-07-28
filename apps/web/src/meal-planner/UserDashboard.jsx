import { authFetch, API_BASE_URL } from './services/api';
import React, { useState, useEffect } from 'react';
import { User, Edit, Save, X, ArrowLeft } from 'lucide-react';

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

const PURPOSE_OPTIONS = [
  'Weight Loss',
  'Weight Gain',
  'Maintain Weight',
  'Build Muscle',
  'Improve Health',
  'Save Time',
  'Learn to Cook',
  'Family Meal Planning'
];

function toNumber(val) {
  const n = parseFloat(val);
  return Number.isNaN(n) ? '' : n;
}

function convertDisplayFromStoredKg(kg, unit) {
  if (kg === '' || kg === null || kg === undefined) return '';
  const n = parseFloat(kg);
  if (Number.isNaN(n)) return '';
  return unit === 'lb' ? (n * LB_PER_KG).toFixed(1) : n.toFixed(1);
}

function convertHelper(value, unit) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '';
  return unit === 'lb'
    ? `${(n * KG_PER_LB).toFixed(1)} kg`
    : `${(n * LB_PER_KG).toFixed(1)} lb`;
}

const UserDashboard = ({ user, onClose, onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editedUser, setEditedUser] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form from user (display weight in user's chosen unit)
  useEffect(() => {
    if (user) {
      const unit = (user.weight_unit || 'kg').toLowerCase();
      setEditedUser({
        username: user.username || '',
        name: user.name || '',
        age: user.age || '',
        email: user.email || '',
        sex: user.sex || '',
        weight: convertDisplayFromStoredKg(user.weight, unit), // show in selected unit
        weight_unit: unit,
        purpose: user.purpose || ''
      });
      setIsEditing(false);
      setHasChanges(false);
      setError('');
    }
  }, [user]);

  const handleInputChange = (field, value) => {
    setEditedUser(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleUnitChange = (value) => {
    // keep numeric as-is (no auto-conversion), just switch unit
    setEditedUser(prev => ({
      ...prev,
      weight_unit: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Prepare payload with correct types
      const payload = {
        username: (editedUser.username || '').trim(),
        name: (editedUser.name || '').trim(),
        age: editedUser.age === '' ? '' : parseInt(editedUser.age, 10),
        sex: editedUser.sex,
        // IMPORTANT: send weight in the selected unit; server normalizes to kg
        weight: editedUser.weight === '' ? '' : parseFloat(editedUser.weight),
        weight_unit: editedUser.weight_unit || 'kg',
        purpose: (editedUser.purpose || '').trim()
      };

      const response = await authFetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        onUserUpdate(data.user);
        setIsEditing(false);
        setHasChanges(false);
        alert('Profile updated successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!user) return;
    const unit = (user.weight_unit || 'kg').toLowerCase();
    setEditedUser({
      username: user.username || '',
      name: user.name || '',
      age: user.age || '',
      email: user.email || '',
      sex: user.sex || '',
      weight: convertDisplayFromStoredKg(user.weight, unit),
      weight_unit: unit,
      purpose: user.purpose || ''
    });
    setIsEditing(false);
    setHasChanges(false);
    setError('');
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
          <p className="text-center text-gray-600">No user data available</p>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-500 text-white px-4 py-2 rounded-xl hover:bg-gray-600 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const unit = editedUser.weight_unit || 'kg';
  const weightMin = unit === 'lb' ? 44 : 20;
  const weightMax = unit === 'lb' ? 1100 : 500;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-green-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="text-white hover:text-orange-200 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <User className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">User Profile</h2>
                <p className="text-orange-100">Manage your account details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-orange-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Profile Picture Section */}
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-orange-500 to-green-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <h3 className="text-xl font-semibold text-gray-800">{user.name}</h3>
              <p className="text-gray-600">@{user.username}</p>
            </div>

            {/* User Details Form */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editedUser.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    !isEditing ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editedUser.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    !isEditing ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editedUser.email}
                  disabled={true} // Email should not be editable
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  value={editedUser.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  disabled={!isEditing}
                  min="1"
                  max="120"
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    !isEditing ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                />
              </div>

              {/* Sex */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sex
                </label>
                <select
                  value={editedUser.sex}
                  onChange={(e) => handleInputChange('sex', e.target.value)}
                  disabled={!isEditing}
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    !isEditing ? 'bg-gray-50 text-gray-600' : ''
                  }`}
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other / Prefer not to say</option>
                </select>
              </div>

              {/* Weight + Unit */}
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={editedUser.weight}
                      onChange={(e) => handleInputChange('weight', e.target.value)}
                      disabled={!isEditing}
                      min={weightMin}
                      max={weightMax}
                      step="0.1"
                      className={`w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        !isEditing ? 'bg-gray-50 text-gray-600' : ''
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                      {unit === 'lb' ? 'lb' : 'kg'}
                    </span>
                  </div>

                  <select
                    value={unit}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    disabled={!isEditing}
                    className={`px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      !isEditing ? 'bg-gray-50 text-gray-600' : ''
                    }`}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter the number in the selected unit. Switching units won’t convert the number automatically.
                </p>
                {editedUser.weight && (
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ {convertHelper(editedUser.weight, unit)}
                  </p>
                )}
              </div>
            </div>

            {/* Purpose */}
              <div>
           <label className="block text-sm font-medium text-gray-700 mb-2">
            Purpose
           </label>
          <select
           value={editedUser.purpose}
           onChange={(e) => handleInputChange('purpose', e.target.value)}
           disabled={!isEditing}
           className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
           !isEditing ? 'bg-gray-50 text-gray-600' : ''
         }`}
  >
         <option value="">Select your goal</option>
         {PURPOSE_OPTIONS.map((option) => (
         <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
</div>


            {/* Account Info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Account Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Member Since:</span>
                  <p>{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>
                  <p>{new Date(user.updated_at || user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 mt-8">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-green-500 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-green-600 transition-all flex items-center justify-center space-x-2"
              >
                <Edit className="w-5 h-5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="flex-1 border border-gray-200 text-gray-600 px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isLoading}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-green-500 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-green-600 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
