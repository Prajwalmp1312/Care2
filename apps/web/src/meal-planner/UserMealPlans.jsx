import { authFetch, API_BASE_URL } from './services/api';
import React, { useState, useEffect } from 'react';
import { Heart, Calendar, Clock, X, ArrowLeft, Trash2, Eye, Star } from 'lucide-react';

const UserMealPlans = ({ user, onClose }) => {
  const [savedMealPlans, setSavedMealPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSavedMealPlans();
    }
  }, [user]);

  const fetchSavedMealPlans = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/saved-meal-plans/${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setSavedMealPlans(data);
      } else {
        console.error('Failed to fetch saved meal plans');
      }
    } catch (error) {
      console.error('Error fetching saved meal plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSavedMealPlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this meal plan?')) return;
    
    try {
      const response = await authFetch(`${API_BASE_URL}/saved-meal-plans/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Meal plan deleted successfully!');
        setSavedMealPlans(savedMealPlans.filter(plan => plan.id !== planId));
      } else {
        throw new Error('Failed to delete meal plan');
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      alert(`Error deleting meal plan: ${error.message}`);
    }
  };

  const viewPlanDetails = (plan) => {
    setSelectedPlan(plan);
    setShowPlanModal(true);
  };

  const getMoodEmoji = (mood) => {
    const moodEmojis = {
      'energetic': '⚡',
      'comfort': '🤗',
      'healthy': '🥗',
      'indulgent': '🍰',
      'fresh': '🌿',
      'spicy': '🌶️'
    };
    return moodEmojis[mood] || '🍽️';
  };

  const getMoodColor = (mood) => {
    const moodColors = {
      'energetic': 'from-orange-500 to-yellow-500',
      'comfort': 'from-amber-500 to-orange-500',
      'healthy': 'from-green-500 to-emerald-500',
      'indulgent': 'from-purple-500 to-pink-500',
      'fresh': 'from-blue-500 to-cyan-500',
      'spicy': 'from-red-500 to-orange-500'
    };
    return moodColors[mood] || 'from-gray-500 to-gray-600';
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
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

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl max-w-6xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* <button
                  onClick={onClose}
                  className="text-white hover:text-purple-200 transition-colors"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button> */}
                <Heart className="w-8 h-8" />
                <div>
                  <h2 className="text-2xl font-bold">My Meal Plans</h2>
                  <p className="text-purple-100">Your saved meal planning history</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-purple-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* User Info */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-6 border border-purple-100">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{user.name}</h3>
                  <p className="text-gray-600 text-sm">@{user.username} • {savedMealPlans.length} saved meal plans</p>
                </div>
              </div>
            </div>

            {/* Meal Plans Grid */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your meal plans...</p>
              </div>
            ) : savedMealPlans.length === 0 ? (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Saved Meal Plans</h3>
                <p className="text-gray-500 mb-6">You haven't saved any meal plans yet</p>
                <button
                  onClick={onClose}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all"
                >
                  Create Your First Meal Plan
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedMealPlans.map((plan) => (
                  <div key={plan.id} className="bg-white rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                    {/* Plan Header */}
                    <div className={`bg-gradient-to-r ${getMoodColor(plan.mood_context)} p-4 rounded-t-2xl text-white`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{getMoodEmoji(plan.mood_context)}</span>
                          <span className="font-semibold text-sm capitalize">{plan.mood_context}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => viewPlanDetails(plan)}
                            className="text-white hover:text-gray-200 transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSavedMealPlan(plan.id)}
                            className="text-white hover:text-red-200 transition-colors"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg truncate">{plan.meal_plan_name}</h3>
                    </div>

                    {/* Plan Content */}
                    <div className="p-4">
                      {/* Meals Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-orange-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-sm">🌅</span>
                            <span className="text-xs font-medium text-orange-800">Breakfast</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{plan.breakfast_name}</p>
                          <p className="text-xs text-gray-600">{plan.breakfast_calories} cal</p>
                        </div>

                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-sm">🥗</span>
                            <span className="text-xs font-medium text-green-800">Lunch</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{plan.lunch_name}</p>
                          <p className="text-xs text-gray-600">{plan.lunch_calories} cal</p>
                        </div>

                        <div className="bg-purple-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-sm">🍽️</span>
                            <span className="text-xs font-medium text-purple-800">Dinner</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{plan.dinner_name}</p>
                          <p className="text-xs text-gray-600">{plan.dinner_calories} cal</p>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-sm">🍎</span>
                            <span className="text-xs font-medium text-blue-800">Snack</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{plan.snack_name}</p>
                          <p className="text-xs text-gray-600">{plan.snack_calories} cal</p>
                        </div>
                      </div>

                      {/* Plan Footer */}
                      <div className="flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-3">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(plan.date_created).toLocaleDateString()}</span>
                        </div>
                        <div className="font-semibold text-gray-800">
                          {plan.total_calories} total cal
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Details Modal */}
      {showPlanModal && selectedPlan && (
        <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className={`bg-gradient-to-r ${getMoodColor(selectedPlan.mood_context)} p-6 rounded-t-2xl text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{getMoodEmoji(selectedPlan.mood_context)}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedPlan.meal_plan_name}</h2>
                    <p className="text-white/80 capitalize">{selectedPlan.mood_context} mood • {selectedPlan.total_calories} total calories</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Breakfast */}
                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-2xl">🌅</span>
                    <h3 className="text-xl font-bold text-orange-800">Breakfast</h3>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{selectedPlan.breakfast_name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{selectedPlan.breakfast_calories} calories</span>
                    </span>
                  </div>
                </div>

                {/* Lunch */}
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-2xl">🥗</span>
                    <h3 className="text-xl font-bold text-green-800">Lunch</h3>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{selectedPlan.lunch_name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{selectedPlan.lunch_calories} calories</span>
                    </span>
                  </div>
                </div>

                {/* Dinner */}
                <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-2xl">🍽️</span>
                    <h3 className="text-xl font-bold text-purple-800">Dinner</h3>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{selectedPlan.dinner_name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{selectedPlan.dinner_calories} calories</span>
                    </span>
                  </div>
                </div>

                {/* Snack */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex items-center space-x-2 mb-4">
                    <span className="text-2xl">🍎</span>
                    <h3 className="text-xl font-bold text-blue-800">Snack</h3>
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">{selectedPlan.snack_name}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center space-x-1">
                      <Star className="w-4 h-4" />
                      <span>{selectedPlan.snack_calories} calories</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Plan Summary */}
              <div className="mt-6 bg-gray-50 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Plan Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{selectedPlan.total_calories}</div>
                    <div className="text-sm text-gray-600">Total Calories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 capitalize">{selectedPlan.mood_context}</div>
                    <div className="text-sm text-gray-600">Mood Context</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">4</div>
                    <div className="text-sm text-gray-600">Meals Planned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {new Date(selectedPlan.date_created).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-600">Date Created</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 mt-6">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this meal plan?')) {
                      deleteSavedMealPlan(selectedPlan.id);
                      setShowPlanModal(false);
                    }
                  }}
                  className="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition-all flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserMealPlans;