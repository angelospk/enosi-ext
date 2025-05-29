<template>
    <div v-if="isVisible" class="persistent-icon-popup-content">
      <h4>Extension Popup</h4>
      <p>Content for this popup will be added later.</p>
      <button @click="closePopup">Close</button>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, defineExpose } from 'vue';
  
  const isVisible = ref(false);
  
  const show = () => {
    isVisible.value = true;
  };
  
  const hide = () => {
    isVisible.value = false;
  };
  
  const toggleVisibility = () => {
    isVisible.value = !isVisible.value;
  };
  
  const closePopup = () => {
    hide();
  }
  
  // Expose methods to be called by the content script
  defineExpose({
    show,
    hide,
    toggleVisibility,
  });
  </script>
  
  <style scoped>
  .persistent-icon-popup-content {
    position: fixed; /* Or absolute if appended near the icon */
    bottom: 70px; /* Example positioning */
    right: 20px;  /* Example positioning */
    width: 250px;
    padding: 15px;
    background-color: white;
    border: 1px solid #ccc;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-radius: 8px;
    z-index: 2147483645; /* High z-index, but below community popup if both are open */
    font-family: sans-serif;
    font-size: 14px;
  }
  .persistent-icon-popup-content h4 {
    margin-top: 0;
    color: #333;
  }
  .persistent-icon-popup-content p {
    color: #555;
    margin-bottom: 15px;
  }
  .persistent-icon-popup-content button {
    padding: 8px 12px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .persistent-icon-popup-content button:hover {
    background-color: #0056b3;
  }
  </style>