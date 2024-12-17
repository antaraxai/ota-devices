import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaPencilAlt, FaTrash, FaBolt } from 'react-icons/fa';

interface DeviceTableProps {
  devices: Device[];
  onUpdate: (deviceId: string) => void;
  onToggleAutoUpdate: (deviceId: string, value: boolean) => void;
  onEdit: (device: Device) => void;
  onDelete: (deviceId: string) => void;
}

const getStatusColor = (status: Device['status']): string => {
  switch (status) {
    case 'online':
      return 'bg-green-100 text-green-800';
    case 'offline':
      return 'bg-red-100 text-red-800';
    case 'updating':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  onUpdate,
  onToggleAutoUpdate,
  onEdit,
  onDelete,
}) => {
  const [blinkStates, setBlinkStates] = useState<{ [key: string]: boolean }>({});

  // Initialize blink states for each device
  useEffect(() => {
    const initialBlinkStates = devices.reduce((acc, device) => {
      acc[device.id] = false;
      return acc;
    }, {} as { [key: string]: boolean });
    setBlinkStates(initialBlinkStates);
  }, [devices]);

  // Blink animation every 5 seconds for each device
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkStates((prev) => {
        const newStates = { ...prev };
        Object.keys(newStates).forEach((id) => {
          newStates[id] = true;
        });
        return newStates;
      });

      // Reset blink after 200ms
      setTimeout(() => {
        setBlinkStates((prev) => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach((id) => {
            newStates[id] = false;
          });
          return newStates;
        });
      }, 200);
    }, 5000);

    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Device
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Auto-Update
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {devices.map((device) => (
            <tr key={device.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col items-center">
                  {/* Eyes */}
                  <div className="flex justify-center space-x-2 mb-2">
                    <div 
                      className={`w-6 h-6 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
                        blinkStates[device.id] ? 'scale-y-[0.1]' : 'scale-y-100'
                      }`} 
                    />
                    <div 
                      className={`w-6 h-6 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
                        blinkStates[device.id] ? 'scale-y-[0.1]' : 'scale-y-100'
                      }`} 
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-900">{device.title}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{device.type}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{device.value}°C</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(device.status)}`}>
                  {device.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={device.auto_update}
                    onChange={(e) => onToggleAutoUpdate(device.id, e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div className="flex space-x-2">
                  <button
                    onClick={() => onUpdate(device.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    <FaBolt className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onEdit(device)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <FaPencilAlt className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(device.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DeviceTable;
