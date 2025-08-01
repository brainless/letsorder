import { Component } from 'solid-js';

interface DragHandleProps {
  class?: string;
}

const DragHandle: Component<DragHandleProps> = (props) => {
  return (
    <div class={`cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 ${props.class || ''}`}>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M8 9l4-4 4 4M8 15l4 4 4-4"
        />
      </svg>
    </div>
  );
};

export default DragHandle;