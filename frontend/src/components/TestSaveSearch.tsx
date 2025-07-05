import React, { useState } from 'react';
import { SaveSearchModal } from './ai-agent/SaveSearchModal';
import type { FlightSearchRequest } from '../types/flight';

export const TestSaveSearch: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  
  const testSearchCriteria: FlightSearchRequest = {
    origin: 'JFK',
    destination: 'LAX',
    departureDate: '2025-01-15',
    returnDate: '2025-01-22',
    passengers: 2,
    tripType: 'round_trip',
    class: 'economy'
  };

  const handleSaveSuccess = () => {
    console.log('Save search successful!');
    alert('Search saved successfully!');
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Test Save Search Modal</h2>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Open Save Search Modal
      </button>
      
      <SaveSearchModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        searchCriteria={testSearchCriteria}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  );
};