import { authFetch, API_BASE_URL } from './services/api';
import React, { useState, useEffect } from 'react';
import { Calendar, Heart, Settings, X, ArrowLeft, TrendingUp, Activity, Droplet, Sun, Moon, Zap, Info, Edit, Save, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

const CycleDashboard = ({ user, cycleData, onClose, onUpdateCycle, onOpenLogger }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [cycleSettings, setCycleSettings] = useState({
    last_period_date: '',
    cycle_length: 28,
    period_length: 5
  });

  useEffect(() => {
    if (cycleData) {
      setCycleSettings({
        last_period_date: cycleData.last_period_date || '',
        cycle_length: cycleData.cycle_length || 28,
        period_length: cycleData.period_length || 5
      });
    }
  }, [cycleData]);

  const getPhaseColor = (phase) => {
    const colors = {
      'menstrual': 'from-red-500 to-pink-500',
      'follicular': 'from-pink-500 to-purple-500',
      'ovulation': 'from-purple-500 to-blue-500',
      'luteal': 'from-blue-500 to-indigo-500'
    };
    return colors[phase] || 'from-gray-400 to-gray-500';
  };

  const getPhaseIcon = (phase) => {
    const icons = {
      'menstrual': <Droplet className="w-6 h-6" />,
      'follicular': <Sun className="w-6 h-6" />,
      'ovulation': <Zap className="w-6 h-6" />,
      'luteal': <Moon className="w-6 h-6" />
    };
    return icons[phase] || <Activity className="w-6 h-6" />;
  };

  const getPhaseDescription = (phase) => {
    const descriptions = {
      'menstrual': 'Your period is here. Focus on iron-rich foods and rest.',
      'follicular': 'Energy is rising! Great time for new activities and lighter meals.',
      'ovulation': 'Peak energy and fertility. Enjoy balanced, nutrient-dense meals.',
      'luteal': 'Preparing for your period. Focus on complex carbs and magnesium.'
    };
    return descriptions[phase] || 'Track your cycle for personalized insights.';
  };

  const getPhaseNutrition = (phase) => {
    const nutrition = {
      'menstrual': [
        { name: 'Iron-rich foods', examples: 'Spinach, red meat, lentils' },
        { name: 'Vitamin C', examples: 'Oranges, bell peppers' },
        { name: 'Omega-3s', examples: 'Salmon, walnuts' }
      ],
      'follicular': [
        { name: 'Lean proteins', examples: 'Chicken, fish, tofu' },
        { name: 'Fresh vegetables', examples: 'Broccoli, carrots, greens' },
        { name: 'Whole grains', examples: 'Quinoa, brown rice' }
      ],
      'ovulation': [
        { name: 'Antioxidants', examples: 'Berries, dark chocolate' },
        { name: 'Fiber', examples: 'Vegetables, fruits, legumes' },
        { name: 'Healthy fats', examples: 'Avocado, nuts, olive oil' }
      ],
      'luteal': [
        { name: 'Complex carbs', examples: 'Sweet potatoes, oats' },
        { name: 'Magnesium', examples: 'Dark chocolate, nuts' },
        { name: 'B vitamins', examples: 'Whole grains, eggs' }
      ]
    };
    return nutrition[phase] || [];
  };

  const generateCalendar = () => {
    if (!cycleData?.last_period_date) return [];

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const calendar = [];
    let dayCounter = 1;

    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let day = 0; day < 7; day++) {
        if ((week === 0 && day < startingDayOfWeek) || dayCounter > daysInMonth) {
          weekDays.push({ day: null, phase: null, isPeriod: false });
        } else {
          const currentDate = new Date(year, month, dayCounter);
          const phase = calculatePhaseForDate(currentDate);
          const isPeriod = isDateInPeriod(currentDate);
          weekDays.push({ day: dayCounter, phase, isPeriod, date: currentDate });
          dayCounter++;
        }
      }
      calendar.push(weekDays);
      if (dayCounter > daysInMonth) break;
    }

    return calendar;
  };

  const calculatePhaseForDate = (date) => {
    if (!cycleData?.last_period_date) return null;

    const lastPeriod = new Date(cycleData.last_period_date);
    const daysSinceLastPeriod = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const dayInCycle = ((daysSinceLastPeriod % cycleData.cycle_length) + cycleData.cycle_length) % cycleData.cycle_length;

    if (dayInCycle < cycleData.period_length) return 'menstrual';
    if (dayInCycle < 13) return 'follicular';
    if (dayInCycle >= 13 && dayInCycle < 16) return 'ovulation';
    return 'luteal';
  };

  const isDateInPeriod = (date) => {
    if (!cycleData?.last_period_date) return false;

    const lastPeriod = new Date(cycleData.last_period_date);
    const daysSinceLastPeriod = Math.floor((date - lastPeriod) / (1000 * 60 * 60 * 24));
    const dayInCycle = ((daysSinceLastPeriod % cycleData.cycle_length) + cycleData.cycle_length) % cycleData.cycle_length;

    return dayInCycle < cycleData.period_length;
  };

  const getPhaseColorForCalendar = (phase) => {
    const colors = {
      'menstrual': 'bg-red-100 border-red-300',
      'follicular': 'bg-pink-100 border-pink-300',
      'ovulation': 'bg-purple-100 border-purple-300',
      'luteal': 'bg-blue-100 border-blue-300'
    };
    return colors[phase] || 'bg-gray-50 border-gray-200';
  };

  const handleSaveSettings = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/users/cycle/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cycleSettings),
      });

      if (response.ok) {
        const data = await response.json();
        onUpdateCycle(data.cycleData);
        setIsEditingSettings(false);
        alert('Cycle settings updated successfully!');
      } else {
        throw new Error('Failed to update cycle settings');
      }
    } catch (error) {
      console.error('Error updating cycle settings:', error);
      alert('Failed to update cycle settings');
    }
  };

  const navigateMonth = (direction) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  if (!cycleData || !cycleData.tracking_enabled) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
          <div className="text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Cycle Tracking Not Enabled</h3>
            <p className="text-gray-600 mb-6">Enable cycle tracking in your profile settings to access this feature.</p>
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const calendar = generateCalendar();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-6xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getPhaseColor(cycleData.current_phase)} text-white p-6 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              {getPhaseIcon(cycleData.current_phase)}
              <div>
                <h2 className="text-2xl font-bold">Cycle Dashboard</h2>
                <p className="text-white/90 capitalize">
                  {cycleData.current_phase} Phase • Day {cycleData.current_day} of {cycleData.cycle_length}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex space-x-1 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Activity className="w-5 h-5 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'calendar'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-5 h-5 inline mr-2" />
              Calendar
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Settings className="w-5 h-5 inline mr-2" />
              Settings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Phase Card */}
              <div className={`bg-gradient-to-r ${getPhaseColor(cycleData.current_phase)} rounded-2xl p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getPhaseIcon(cycleData.current_phase)}
                    <div>
                      <h3 className="text-2xl font-bold capitalize">{cycleData.current_phase} Phase</h3>
                      <p className="text-white/80">Day {cycleData.current_day} of your cycle</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">{cycleData.days_until_period}</p>
                    <p className="text-sm text-white/80">days until period</p>
                  </div>
                </div>
                <p className="text-white/90">{getPhaseDescription(cycleData.current_phase)}</p>
              </div>

              {/* Quick Stats */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-100">
                  <div className="flex items-center space-x-3 mb-2">
                    <Calendar className="w-5 h-5 text-pink-600" />
                    <span className="font-semibold text-gray-800">Next Period</span>
                  </div>
                  <p className="text-2xl font-bold text-pink-600">
                    {new Date(cycleData.predicted_next_period).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600">in {cycleData.days_until_period} days</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
                  <div className="flex items-center space-x-3 mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-800">Cycle Length</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{cycleData.cycle_length} days</p>
                  <p className="text-sm text-gray-600">Average cycle duration</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center space-x-3 mb-2">
                    <Droplet className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-800">Period Length</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{cycleData.period_length} days</p>
                  <p className="text-sm text-gray-600">Typical period duration</p>
                </div>
              </div>

              {/* Nutrition Recommendations */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Info className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-800">Recommended Nutrition</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {getPhaseNutrition(cycleData.current_phase).map((item, index) => (
                    <div key={index} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <h4 className="font-semibold text-purple-800 mb-2">{item.name}</h4>
                      <p className="text-sm text-gray-600">{item.examples}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase Timeline */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Cycle Phase Timeline</h3>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Day 1</span>
                    <span className="text-sm font-medium text-gray-600">Day {cycleData.cycle_length}</span>
                  </div>
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-gradient-to-r from-red-500 to-pink-500" 
                      style={{ width: `${(cycleData.period_length / cycleData.cycle_length) * 100}%` }}
                    />
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-purple-500" 
                      style={{ width: `${((13 - cycleData.period_length) / cycleData.cycle_length) * 100}%` }}
                    />
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500" 
                      style={{ width: `${(3 / cycleData.cycle_length) * 100}%` }}
                    />
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500" 
                      style={{ width: `${((cycleData.cycle_length - 16) / cycleData.cycle_length) * 100}%` }}
                    />
                  </div>
                  <div className="absolute top-0 h-full" style={{ left: `${(cycleData.current_day / cycleData.cycle_length) * 100}%` }}>
                    <div className="w-1 h-full bg-gray-800 relative">
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                        Day {cycleData.current_day}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <div className="text-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mx-auto mb-1" />
                    <span className="text-xs text-gray-600">Menstrual</span>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full mx-auto mb-1" />
                    <span className="text-xs text-gray-600">Follicular</span>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-1" />
                    <span className="text-xs text-gray-600">Ovulation</span>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mx-auto mb-1" />
                    <span className="text-xs text-gray-600">Luteal</span>
                  </div>
                </div>
              </div>

              {/* Quick Log Button - NEW FOR PHASE 3 */}
              {onOpenLogger && (
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-100 text-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-2">📝 Log Today's Entry</h3>
                  <p className="text-gray-600 text-sm mb-4">Track your symptoms, cravings, and mood</p>
                  <button
                    onClick={() => {
                      onClose();
                      setTimeout(() => onOpenLogger(), 100);
                    }}
                    className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all inline-flex items-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Log Entry</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-purple-600" />
                </button>
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-purple-600" />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {calendar.map((week, weekIndex) => (
                    <div key={weekIndex} className="grid grid-cols-7 gap-2">
                      {week.map((dayData, dayIndex) => (
                        <div
                          key={dayIndex}
                          className={`aspect-square flex items-center justify-center rounded-lg border-2 transition-all ${
                            dayData.day
                              ? `${getPhaseColorForCalendar(dayData.phase)} hover:shadow-md cursor-pointer ${
                                  dayData.isPeriod ? 'ring-2 ring-red-400' : ''
                                }`
                              : 'bg-transparent border-transparent'
                          }`}
                        >
                          {dayData.day && (
                            <div className="text-center">
                              <div className={`font-semibold ${dayData.isPeriod ? 'text-red-700' : 'text-gray-700'}`}>
                                {dayData.day}
                              </div>
                              {dayData.isPeriod && (
                                <Droplet className="w-3 h-3 text-red-500 mx-auto mt-1" />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Droplet className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-800 text-sm">Menstrual</span>
                  </div>
                  <p className="text-xs text-gray-600">Period days</p>
                </div>
                <div className="bg-pink-50 rounded-xl p-3 border border-pink-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Sun className="w-4 h-4 text-pink-600" />
                    <span className="font-semibold text-pink-800 text-sm">Follicular</span>
                  </div>
                  <p className="text-xs text-gray-600">Rising energy</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Zap className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-800 text-sm">Ovulation</span>
                  </div>
                  <p className="text-xs text-gray-600">Peak fertility</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Moon className="w-4 h-4 text-blue-600" />
                    <span className="font-semibold text-blue-800 text-sm">Luteal</span>
                  </div>
                  <p className="text-xs text-gray-600">Pre-period</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Cycle Settings</h3>
                    <p className="text-gray-600">Update your cycle information for accurate tracking</p>
                  </div>
                  {!isEditingSettings && (
                    <button
                      onClick={() => setIsEditingSettings(true)}
                      className="flex items-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600 transition-all"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Period Start Date
                    </label>
                    <input
                      type="date"
                      value={cycleSettings.last_period_date}
                      onChange={(e) => setCycleSettings({ ...cycleSettings, last_period_date: e.target.value })}
                      disabled={!isEditingSettings}
                      className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        !isEditingSettings ? 'bg-gray-50 text-gray-600' : ''
                      }`}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cycle Length (days)
                      </label>
                      <input
                        type="number"
                        value={cycleSettings.cycle_length}
                        onChange={(e) => setCycleSettings({ ...cycleSettings, cycle_length: parseInt(e.target.value) })}
                        disabled={!isEditingSettings}
                        min="21"
                        max="35"
                        className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          !isEditingSettings ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Average: 28 days</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Period Length (days)
                      </label>
                      <input
                        type="number"
                        value={cycleSettings.period_length}
                        onChange={(e) => setCycleSettings({ ...cycleSettings, period_length: parseInt(e.target.value) })}
                        disabled={!isEditingSettings}
                        min="2"
                        max="7"
                        className={`w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          !isEditingSettings ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Average: 5 days</p>
                    </div>
                  </div>

                  {isEditingSettings && (
                    <div className="flex space-x-4 pt-4">
                      <button
                        onClick={() => {
                          setCycleSettings({
                            last_period_date: cycleData.last_period_date || '',
                            cycle_length: cycleData.cycle_length || 28,
                            period_length: cycleData.period_length || 5
                          });
                          setIsEditingSettings(false);
                        }}
                        className="flex-1 border border-gray-200 text-gray-600 px-6 py-3 rounded-xl hover:bg-gray-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSettings}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center space-x-2"
                      >
                        <Save className="w-5 h-5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tips & Info */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4">💡 Tracking Tips</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span>Update your last period date as soon as your period starts for accurate predictions</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span>Most cycles are 21-35 days long - use your average cycle length</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span>Period length typically ranges from 2-7 days</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span>Our meal recommendations automatically adjust based on your current phase</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CycleDashboard;