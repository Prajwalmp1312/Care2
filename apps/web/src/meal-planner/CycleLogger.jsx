import { authFetch, API_BASE_URL } from './services/api';
import React, { useState, useEffect } from 'react';
import { Heart, TrendingUp, Calendar, X, Plus, Sparkles, AlertCircle, Coffee, Cookie, Pizza, IceCream, ChevronDown, ChevronUp, Activity, Droplet, Zap, Moon, Brain, Eye } from 'lucide-react';

const CycleLogger = ({ user, cycleData, onClose, onLogSaved }) => {
  const [activeTab, setActiveTab] = useState('log');
  const [logs, setLogs] = useState([]);
  const [patterns, setPatterns] = useState(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Current log form state
  const [currentLog, setCurrentLog] = useState({
    date: new Date().toISOString().split('T')[0],
    cravings: [],
    symptoms: [],
    mood: '',
    energy_level: 3,
    notes: ''
  });

  const [customCraving, setCustomCraving] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Predefined options
  const cravingOptions = [
    { name: 'Chocolate', icon: '🍫', category: 'sweet' },
    { name: 'Salty Snacks', icon: '🥨', category: 'salty' },
    { name: 'Ice Cream', icon: '🍦', category: 'sweet' },
    { name: 'Pizza', icon: '🍕', category: 'carbs' },
    { name: 'Sweets', icon: '🍬', category: 'sweet' },
    { name: 'Carbs', icon: '🍞', category: 'carbs' },
    { name: 'Fried Food', icon: '🍟', category: 'salty' },
    { name: 'Coffee', icon: '☕', category: 'caffeine' }
  ];

  const symptomOptions = [
    { name: 'Cramps', icon: '😣', severity: 'physical' },
    { name: 'Bloating', icon: '🎈', severity: 'physical' },
    { name: 'Headache', icon: '🤕', severity: 'physical' },
    { name: 'Fatigue', icon: '😴', severity: 'physical' },
    { name: 'Mood Swings', icon: '😢', severity: 'emotional' },
    { name: 'Anxiety', icon: '😰', severity: 'emotional' },
    { name: 'Irritability', icon: '😠', severity: 'emotional' },
    { name: 'Breast Tenderness', icon: '💢', severity: 'physical' },
    { name: 'Back Pain', icon: '🔥', severity: 'physical' },
    { name: 'Acne', icon: '🔴', severity: 'physical' }
  ];

  const moodOptions = [
    { value: 'happy', label: 'Happy', emoji: '😊', color: 'text-yellow-500' },
    { value: 'calm', label: 'Calm', emoji: '😌', color: 'text-blue-500' },
    { value: 'energetic', label: 'Energetic', emoji: '⚡', color: 'text-orange-500' },
    { value: 'tired', label: 'Tired', emoji: '😴', color: 'text-gray-500' },
    { value: 'anxious', label: 'Anxious', emoji: '😰', color: 'text-purple-500' },
    { value: 'irritable', label: 'Irritable', emoji: '😠', color: 'text-red-500' },
    { value: 'sad', label: 'Sad', emoji: '😢', color: 'text-blue-600' }
  ];

  useEffect(() => {
    if (user && activeTab !== 'log') {
      fetchLogs();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (activeTab === 'patterns' && logs.length > 0 && !patterns) {
      analyzePatterns();
    }
  }, [activeTab, logs]);

  useEffect(() => {
    if (activeTab === 'insights' && logs.length > 0 && !aiInsights) {
      generateAIInsights();
    }
  }, [activeTab, logs]);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/cycle-logs/${user.id}?limit=30`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const analyzePatterns = async () => {
    setIsLoadingPatterns(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/analyze-cycle-patterns/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setPatterns(data);
      }
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    } finally {
      setIsLoadingPatterns(false);
    }
  };

  const generateAIInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/generate-cycle-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          logs: logs.slice(0, 10),
          cycleData: cycleData
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const toggleCraving = (craving) => {
    setCurrentLog(prev => ({
      ...prev,
      cravings: prev.cravings.includes(craving)
        ? prev.cravings.filter(c => c !== craving)
        : [...prev.cravings, craving]
    }));
  };

  const toggleSymptom = (symptom) => {
    setCurrentLog(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom]
    }));
  };

  const addCustomCraving = () => {
    if (customCraving.trim() && !currentLog.cravings.includes(customCraving.trim())) {
      setCurrentLog(prev => ({
        ...prev,
        cravings: [...prev.cravings, customCraving.trim()]
      }));
      setCustomCraving('');
    }
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim() && !currentLog.symptoms.includes(customSymptom.trim())) {
      setCurrentLog(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, customSymptom.trim()]
      }));
      setCustomSymptom('');
    }
  };

  const saveLog = async () => {
    if (currentLog.cravings.length === 0 && currentLog.symptoms.length === 0) {
      alert('Please log at least one craving or symptom');
      return;
    }

    setIsSavingLog(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/log-cycle-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          log_date: currentLog.date,
          cravings: currentLog.cravings,
          symptoms: currentLog.symptoms,
          mood: currentLog.mood,
          energy_level: currentLog.energy_level,
          notes: currentLog.notes
        })
      });

      if (response.ok) {
        alert('Log saved successfully! 🎉');
        setCurrentLog({
          date: new Date().toISOString().split('T')[0],
          cravings: [],
          symptoms: [],
          mood: '',
          energy_level: 3,
          notes: ''
        });
        if (onLogSaved) onLogSaved();
        fetchLogs();
      } else {
        throw new Error('Failed to save log');
      }
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Failed to save log: ' + error.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  const getPhaseColor = (phase) => {
    const colors = {
      'menstrual': 'from-red-500 to-pink-500',
      'follicular': 'from-pink-500 to-purple-500',
      'ovulation': 'from-purple-500 to-blue-500',
      'luteal': 'from-blue-500 to-indigo-500'
    };
    return colors[phase] || 'from-gray-400 to-gray-500';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-5xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r ${getPhaseColor(cycleData?.current_phase)} text-white p-6 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Heart className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Cycle Journal</h2>
                <p className="text-white/90">Track symptoms, cravings & discover patterns</p>
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
              onClick={() => setActiveTab('log')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'log'
                  ? 'border-b-2 border-pink-500 text-pink-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Log Entry
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'border-b-2 border-pink-500 text-pink-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-5 h-5 inline mr-2" />
              History
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'patterns'
                  ? 'border-b-2 border-pink-500 text-pink-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <TrendingUp className="w-5 h-5 inline mr-2" />
              Patterns
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-4 font-medium transition-colors ${
                activeTab === 'insights'
                  ? 'border-b-2 border-pink-500 text-pink-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Sparkles className="w-5 h-5 inline mr-2" />
              AI Insights
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Log Entry Tab */}
          {activeTab === 'log' && (
            <div className="space-y-6">
              {/* Date Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={currentLog.date}
                  onChange={(e) => setCurrentLog({ ...currentLog, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Cravings Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">🍫 Cravings</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  {cravingOptions.map((craving) => (
                    <button
                      key={craving.name}
                      onClick={() => toggleCraving(craving.name)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        currentLog.cravings.includes(craving.name)
                          ? 'bg-pink-100 border-pink-500 text-pink-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-pink-300'
                      }`}
                    >
                      <span className="text-2xl mb-1 block">{craving.icon}</span>
                      <span className="text-sm font-medium">{craving.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom craving..."
                    value={customCraving}
                    onChange={(e) => setCustomCraving(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomCraving()}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button
                    onClick={addCustomCraving}
                    className="bg-pink-500 text-white px-4 py-2 rounded-xl hover:bg-pink-600"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {currentLog.cravings.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentLog.cravings.map((craving, idx) => (
                      <span key={idx} className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {craving}
                        <button onClick={() => toggleCraving(craving)} className="hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Symptoms Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">💢 Symptoms</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                  {symptomOptions.map((symptom) => (
                    <button
                      key={symptom.name}
                      onClick={() => toggleSymptom(symptom.name)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        currentLog.symptoms.includes(symptom.name)
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <span className="text-2xl mb-1 block">{symptom.icon}</span>
                      <span className="text-xs font-medium">{symptom.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom symptom..."
                    value={customSymptom}
                    onChange={(e) => setCustomSymptom(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomSymptom()}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={addCustomSymptom}
                    className="bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {currentLog.symptoms.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentLog.symptoms.map((symptom, idx) => (
                      <span key={idx} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {symptom}
                        <button onClick={() => toggleSymptom(symptom)} className="hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mood Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">😊 Mood</h3>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                  {moodOptions.map((mood) => (
                    <button
                      key={mood.value}
                      onClick={() => setCurrentLog({ ...currentLog, mood: mood.value })}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        currentLog.mood === mood.value
                          ? 'bg-yellow-100 border-yellow-500'
                          : 'bg-white border-gray-200 hover:border-yellow-300'
                      }`}
                    >
                      <span className="text-3xl block">{mood.emoji}</span>
                      <span className="text-xs font-medium text-gray-700">{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Level */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">⚡ Energy Level</h3>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={currentLog.energy_level}
                    onChange={(e) => setCurrentLog({ ...currentLog, energy_level: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-orange-600">{currentLog.energy_level}/5</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Very Low</span>
                  <span>Very High</span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📝 Notes</h3>
                <textarea
                  value={currentLog.notes}
                  onChange={(e) => setCurrentLog({ ...currentLog, notes: e.target.value })}
                  placeholder="Any additional notes about how you're feeling today..."
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              {/* Save Button */}
              <button
                onClick={saveLog}
                disabled={isSavingLog}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-4 rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all disabled:opacity-50 font-semibold text-lg"
              >
                {isSavingLog ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {isLoadingLogs ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your history...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">No Logs Yet</h3>
                  <p className="text-gray-500">Start logging your symptoms and cravings!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        {log.mood && (
                          <p className="text-sm text-gray-600">
                            Mood: {moodOptions.find(m => m.value === log.mood)?.emoji} {log.mood}
                            {log.energy_level && ` • Energy: ${log.energy_level}/5`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        className="text-pink-600 hover:text-pink-800"
                      >
                        {expandedLogId === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {log.cravings && JSON.parse(log.cravings).length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-pink-700 mb-1">Cravings:</p>
                        <div className="flex flex-wrap gap-1">
                          {JSON.parse(log.cravings).map((craving, idx) => (
                            <span key={idx} className="bg-pink-200 text-pink-800 px-2 py-0.5 rounded-full text-xs">
                              {craving}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {log.symptoms && JSON.parse(log.symptoms).length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-purple-700 mb-1">Symptoms:</p>
                        <div className="flex flex-wrap gap-1">
                          {JSON.parse(log.symptoms).map((symptom, idx) => (
                            <span key={idx} className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs">
                              {symptom}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {expandedLogId === log.id && log.notes && (
                      <div className="mt-3 pt-3 border-t border-pink-200">
                        <p className="text-sm text-gray-700">{log.notes}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Patterns Tab */}
          {activeTab === 'patterns' && (
            <div className="space-y-6">
              {isLoadingPatterns ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Analyzing your patterns...</p>
                </div>
              ) : !patterns ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Not enough data to analyze patterns yet</p>
                </div>
              ) : (
                <>
                  {/* Most Common Cravings */}
                  {patterns.topCravings && patterns.topCravings.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-pink-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Cookie className="w-6 h-6 mr-2 text-pink-600" />
                        Most Common Cravings
                      </h3>
                      <div className="space-y-3">
                        {patterns.topCravings.map((craving, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-gray-700">{craving.name}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-32 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-full bg-gradient-to-r from-pink-400 to-pink-600 rounded-full"
                                  style={{ width: `${(craving.count / patterns.totalLogs) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-pink-600">{craving.count}x</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Most Common Symptoms */}
                  {patterns.topSymptoms && patterns.topSymptoms.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-purple-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Activity className="w-6 h-6 mr-2 text-purple-600" />
                        Most Common Symptoms
                      </h3>
                      <div className="space-y-3">
                        {patterns.topSymptoms.map((symptom, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="text-gray-700">{symptom.name}</span>
                            <div className="flex items-center space-x-2">
                              <div className="w-32 h-2 bg-gray-200 rounded-full">
                                <div 
                                  className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"
                                  style={{ width: `${(symptom.count / patterns.totalLogs) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-purple-600">{symptom.count}x</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Phase Correlations */}
                  {patterns.phasePatterns && (
                    <div className="bg-white rounded-xl p-6 border border-blue-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <TrendingUp className="w-6 h-6 mr-2 text-blue-600" />
                        Phase-Specific Patterns
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {Object.entries(patterns.phasePatterns).map(([phase, data]) => (
                          <div key={phase} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-800 capitalize mb-2">{phase} Phase</h4>
                            {data.commonCravings && data.commonCravings.length > 0 && (
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">Common cravings:</span> {data.commonCravings.join(', ')}
                              </p>
                            )}
                            {data.commonSymptoms && data.commonSymptoms.length > 0 && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Common symptoms:</span> {data.commonSymptoms.join(', ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mood Trends */}
                  {patterns.moodTrends && (
                    <div className="bg-white rounded-xl p-6 border border-yellow-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Brain className="w-6 h-6 mr-2 text-yellow-600" />
                        Mood Trends
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {patterns.moodTrends.map((mood, idx) => (
                          <div key={idx} className="bg-yellow-50 rounded-lg p-3 text-center">
                            <span className="text-3xl block mb-1">
                              {moodOptions.find(m => m.value === mood.mood)?.emoji}
                            </span>
                            <p className="text-sm font-medium text-gray-700 capitalize">{mood.mood}</p>
                            <p className="text-xs text-gray-500">{mood.count} times</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {isLoadingInsights ? (
                <div className="text-center py-12">
                  <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-600">AI is analyzing your cycle data...</p>
                  <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                </div>
              ) : !aiInsights ? (
                <div className="text-center py-12">
                  <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Not enough data for AI insights yet</p>
                  <p className="text-sm text-gray-500 mt-2">Log at least 5 entries to get personalized insights</p>
                </div>
              ) : (
                <>
                  {/* AI Summary */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-200">
                    <div className="flex items-start space-x-3 mb-4">
                      <Sparkles className="w-8 h-8 text-purple-600 flex-shrink-0" />
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">AI-Powered Insights</h3>
                        <p className="text-gray-700 leading-relaxed">{aiInsights.summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-green-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Eye className="w-6 h-6 mr-2 text-green-600" />
                        Personalized Recommendations
                      </h3>
                      <div className="space-y-3">
                        {aiInsights.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start space-x-3 bg-green-50 rounded-lg p-4">
                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {idx + 1}
                            </div>
                            <p className="text-gray-700">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Craving Alternatives */}
                  {aiInsights.cravingAlternatives && Object.keys(aiInsights.cravingAlternatives).length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-orange-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <Coffee className="w-6 h-6 mr-2 text-orange-600" />
                        Healthy Craving Alternatives
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(aiInsights.cravingAlternatives).map(([craving, alternatives], idx) => (
                          <div key={idx} className="bg-orange-50 rounded-lg p-4">
                            <p className="font-semibold text-gray-800 mb-2">
                              When craving <span className="text-orange-600">{craving}</span>, try:
                            </p>
                            <p className="text-gray-700 text-sm">{alternatives}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Symptom Management */}
                  {aiInsights.symptomManagement && Object.keys(aiInsights.symptomManagement).length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-blue-100">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <AlertCircle className="w-6 h-6 mr-2 text-blue-600" />
                        Symptom Management Tips
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(aiInsights.symptomManagement).map(([symptom, tips], idx) => (
                          <div key={idx} className="bg-blue-50 rounded-lg p-4">
                            <p className="font-semibold text-gray-800 mb-2">
                              For <span className="text-blue-600">{symptom}</span>:
                            </p>
                            <p className="text-gray-700 text-sm">{tips}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Regenerate Button */}
                  <button
                    onClick={() => {
                      setAiInsights(null);
                      generateAIInsights();
                    }}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Regenerate Insights</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CycleLogger;