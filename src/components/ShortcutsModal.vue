<template>
  <div v-if="isVisible" class="shortcuts-modal-overlay" @click.self="close">
    <div class="shortcuts-modal-content">
      <h3> Συντομεύσεις πληκτρολογίου</h3>
      <ul>
        <li><strong>Ctrl + 1:</strong> Γενικά Στοιχεία  (ξανά: Γενικά Στοιχεία Αιτούντα)</li>
        <li><strong>Ctrl + 2:</strong> Γενικά Στοιχεία: Συγκατάθεση GDPR</li>
        <li><strong>Ctrl + 3:</strong> Επιχειρήσεις Βιοκαυσίμων</li>
        <li><strong>Ctrl + 4:</strong> Αγροτεμάχια</li>
        <li><strong>Ctrl + 5:</strong> Έλεγχος Λαθών</li>
        <li><strong>Ctrl + 6:</strong> Δικαιολογητικά</li>
    
        <li><strong>Ctrl + 0:</strong> Απόκρυψη/Εμφάνιση UI</li>
        <li><strong>Ctrl + I:</strong> Αντιγραφή Καλλιεργειών & Οικολογικών Σχημάτων</li>
        <li><strong>Ctrl + B:</strong> Αντιγραφή Bioflag (Τήρηση)</li>
        <li><strong>Ctrl + S:</strong> Αποθήκευση</li>
        <!-- <li><strong>Ctrl + E:</strong> Αντιγραφή Ιδιοκτησίας Προηγούμενου Έτους</li> -->
        <li><strong>Ctrl + O:</strong> Εμφάνιση/Απόκρυψη παραθύρου</li>
        <li><strong>Ctrl + Q:</strong> Εύρεση αχρησιμοποίητων ιδιόκτητων αγροτεμαχίων (κονσόλα)</li> 
        <li><strong>Ctrl + M:</strong> Λήψη Περσινών Συγκεντρωτικών Στοιχείων (χωρίς γεωγραφικά δεδομένα)</li>
        <!-- <li><strong>Ctrl + `:</strong> Μαζική αντιγραφή ενοικιαστηρίων</li> -->
        <li><strong>Shift + ?:</strong> Εμφάνιση συντομεύσεων</li>
      </ul>
      <button @click="close">Κλείσιμο</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isVisible = ref(false);

const open = () => {
  isVisible.value = true;
};

const close = () => {
  isVisible.value = false;
};

defineExpose({ open, close });
</script>

<style scoped>
.shortcuts-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2147483647;
}

.shortcuts-modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 500px;
}

.shortcuts-modal-content h3 {
  margin-top: 0;
}

.shortcuts-modal-content ul {
  list-style: none;
  padding: 0;
}

.shortcuts-modal-content li {
  margin-bottom: 0.5rem;
}

.shortcuts-modal-content button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border: none;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.shortcuts-modal-content button:hover {
  background-color: #0056b3;
}
</style>
