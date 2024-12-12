import React from 'react';
import { FaThermometerHalf, FaLightbulb, FaLock, FaComment, FaEdit } from 'react-icons/fa';
import CretaExpression from './CretaExpression';
import { DeviceStatus } from '../types/device';

interface InputCardProps {
  title: string;
  type: 'Thermostat' | 'Light' | 'Lock' | 'Camera';
  value: number;
  unit: '°C' | '%';
  time: string;
  status: DeviceStatus;
  autoUpdate: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'Thermostat': return FaThermometerHalf;
    case 'Light': return FaLightbulb;
    case 'Lock': return FaLock;
    default: return FaThermometerHalf;
  }
};

const InputCard: React.FC<InputCardProps> = ({
  title,
  type,
  value,
  unit,
  time,
  status,
  autoUpdate
}) => {
  const Icon = getIcon(type);
  
  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 w-full">
      <div className="flex flex-col gap-6">
        {/* Expression at the top */}
        <div className="flex justify-center -mt-2 mb-2">
          <CretaExpression 
            className="transform scale-50"
            status={autoUpdate ? 'online' : 'offline'}
            health={status === 'Normal' ? 'good' : 
                   status === 'Warning' ? 'warning' :
                   status === 'High' ? 'critical' : 'warning'}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-4 bg-gray-100 rounded-2xl">
              <Icon className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="text-gray-500">{type}</p>
            </div>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm ${
            status === 'Normal' ? 'bg-gray-100 text-gray-800' : 'bg-red-500 text-white'
          }`}>
            {status}
          </span>
        </div>

        {/* Value Display */}
        <div className="bg-green-50 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-6 h-6 text-gray-600" />
              <span className="text-4xl font-bold">{value}</span>
              <span className="text-xl text-gray-600">{unit}</span>
            </div>
            <span className="text-gray-500">{time}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-600">Auto-update</span>
            <button 
              className={`w-12 h-6 rounded-full transition-colors relative ${
                autoUpdate ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                autoUpdate ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700">
              <FaComment className="w-5 h-5" />
            </button>
            <button className="text-gray-500 hover:text-gray-700">
              <FaEdit className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputCard; 