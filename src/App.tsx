import React from 'react';
import InputCard from './components/InputCard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-8"># Inputs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <InputCard
          title="Living Room"
          type="Thermostat"
          value={23.8}
          unit="°C"
          time="11:15 AM"
          status="Normal"
          autoUpdate={true}
        />
        <InputCard
          title="Server"
          type="Light"
          value={70.7}
          unit="%"
          time="11:15 AM"
          status="Normal"
          autoUpdate={false}
        />
        <InputCard
          title="Front Door"
          type="Lock"
          value={24}
          unit="°C"
          time="11:09 AM"
          status="High"
          autoUpdate={true}
        />
      </div>
    </div>
  );
}

export default App;