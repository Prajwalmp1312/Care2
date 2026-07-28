import React from 'react';
import { Droplet, Sun, Zap, Moon, Calendar } from 'lucide-react';

const CyclePhaseBadge = ({ cycleData, onClick }) => {
  if (!cycleData || !cycleData.tracking_enabled) {
    return null;
  }

  const getPhaseIcon = (phase) => {
    const icons = {
      'menstrual': <Droplet className="w-4 h-4" />,
      'follicular': <Sun className="w-4 h-4" />,
      'ovulation': <Zap className="w-4 h-4" />,
      'luteal': <Moon className="w-4 h-4" />
    };
    return icons[phase] || <Calendar className="w-4 h-4" />;
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

  const getPhaseLabel = (phase) => {
    const labels = {
      'menstrual': 'Period',
      'follicular': 'Follicular',
      'ovulation': 'Ovulation',
      'luteal': 'Luteal'
    };
    return labels[phase] || 'Tracking';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 bg-gradient-to-r ${getPhaseColor(cycleData.current_phase)} text-white px-4 py-2 rounded-full hover:shadow-lg transition-all transform hover:scale-105 group`}
      title="View Cycle Dashboard"
    >
      <div className="flex items-center space-x-2">
        {getPhaseIcon(cycleData.current_phase)}
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium leading-tight">
            {getPhaseLabel(cycleData.current_phase)}
          </span>
          <span className="text-xs leading-tight opacity-90">
            Day {cycleData.current_day}
          </span>
        </div>
      </div>
      {cycleData.days_until_period <= 3 && (
        <div className="bg-white/20 rounded-full px-2 py-0.5">
          <span className="text-xs font-bold">
            {cycleData.days_until_period}d
          </span>
        </div>
      )}
    </button>
  );
};

export default CyclePhaseBadge;