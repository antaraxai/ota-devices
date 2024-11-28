import React from 'react';
import { UpdatePackage } from '../types';
import { Package, Calendar, Network } from 'lucide-react';

interface UpdatePackageCardProps {
  pkg: UpdatePackage;
  onDeploy: (version: string) => void;
}

export const UpdatePackageCard: React.FC<UpdatePackageCardProps> = ({ pkg, onDeploy }) => {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    testing: 'bg-yellow-100 text-yellow-800',
    released: 'bg-green-100 text-green-800'
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Package className="w-6 h-6 text-gray-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Version {pkg.version}</h3>
            <span className={`text-sm px-2 py-1 rounded-full ${statusColors[pkg.status]}`}>
              {pkg.status}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-gray-600">{pkg.description}</p>

        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{new Date(pkg.releaseDate).toLocaleDateString()}</span>
        </div>

        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Network className="w-4 h-4" />
          <span>{pkg.targetDevices.length} target devices</span>
        </div>

        {pkg.status === 'testing' && (
          <button
            onClick={() => onDeploy(pkg.version)}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
          >
            Deploy to Production
          </button>
        )}
      </div>
    </div>
  );
};