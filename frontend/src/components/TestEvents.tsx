import { useState } from 'react';

export function TestEvents() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  console.log('TestEvents render - count:', count, 'text:', text);

  return (
    <div className="p-4 border-2 border-red-500 m-4">
      <h2 className="text-xl font-bold mb-4">Event Test Component</h2>
      
      <div className="mb-4">
        <p>Count: {count}</p>
        <button
          type="button"
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => {
            console.log('Button clicked!');
            setCount(c => c + 1);
          }}
          onPointerDown={() => console.log('Pointer down!')}
        >
          Click me (count: {count})
        </button>
      </div>

      <div className="mb-4">
        <p>Text: {text}</p>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            console.log('Input changed:', e.target.value);
            setText(e.target.value);
          }}
          className="px-2 py-1 border rounded"
          placeholder="Type here..."
        />
      </div>

      <div className="text-sm text-gray-600">
        <p>Check console for event logs</p>
      </div>
    </div>
  );
}