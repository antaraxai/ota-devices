import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { FaGithub } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';

interface DeviceTableProps {
  devices: Device[];
  onUpdate: (deviceId: string) => void;
}

const DeviceTable: React.FC<DeviceTableProps> = ({ 
  devices,
  onUpdate
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

  // Format the value to handle long decimal numbers
  const formatValue = (value: number) => {
    return value >= 100 ? value.toFixed(0) : value.toFixed(1);
  };

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
              GitHub
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {devices.map((device) => (
            <tr key={device.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col items-center">
                  {/* Eyes */}
                  <div className="flex justify-center space-x-4 mb-2">
                    <div 
                      className={`w-8 h-8 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
                        blinkStates[device.id] ? 'scale-y-[0.1]' : 'scale-y-100'
                      }`} 
                    />
                    <div 
                      className={`w-8 h-8 bg-black rounded-t-full transition-transform duration-200 origin-bottom ${
                        blinkStates[device.id] ? 'scale-y-[0.1]' : 'scale-y-100'
                      }`} 
                    />
                  </div>
                  <div className="text-sm font-medium text-gray-900">{device.device_tag}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{device.type}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {formatValue(device.value)} {device.unit}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  device.status === 'online' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <FiZap className={`w-3 h-3 mr-1 ${
                    device.status === 'online' 
                      ? 'text-green-500' 
                      : 'text-red-500'
                  }`} />
                  {device.status}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {device.repo_url ? (
                  <div className="text-sm text-gray-500 flex items-center">
                    <FaGithub className="w-4 h-4 mr-1" />
                    Connected
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DeviceTable;
