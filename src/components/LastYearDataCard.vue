<template>
  <div class="last-year-data-card">
    <h3 class="card-title">Στοιχεία Προηγούμενου Έτους</h3>
    <div v-if="store.isLoading" class="loading-state">
      <p>Φόρτωση περσινών στοιχείων...</p>
    </div>
    <div v-else-if="store.error" class="error-state">
      <p class="error-title">Σφάλμα!</p>
      <p class="error-message">{{ store.error }}</p>
    </div>
    <div v-else-if="store.data" class="data-display">
      <div class="data-section">
        <h4>Προγράμματα Αγροτικής Ανάπτυξης (ΠΑΑ)</h4>
        <ul>
          <li v-for="item in store.data.paa" :key="item.code">{{ item.name }}</li>
        </ul>
        <p v-if="!store.data.paa || store.data.paa.length === 0">Δεν βρέθηκαν στοιχεία.</p>
      </div>
      <div class="data-section">
        <h4>Οικολογικά Σχήματα</h4>
        <ul>
          <li v-for="item in store.data.eco" :key="item.code">{{ item.name }}</li>
        </ul>
         <p v-if="!store.data.eco || store.data.eco.length === 0">Δεν βρέθηκαν στοιχεία.</p>
      </div>
      <div class="data-section">
        <h4>Συνδεδεμένες Ενισχύσεις</h4>
        <ul>
          <li v-for="item in store.data.con" :key="item.code">{{ item.name }}</li>
        </ul>
         <p v-if="!store.data.con || store.data.con.length === 0">Δεν βρέθηκαν στοιχεία.</p>
      </div>
    </div>
    <div v-else class="no-data-state">
        <p>Δεν υπάρχουν διαθέσιμα δεδομένα για το προηγούμενο έτος.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useLastYearDataStore } from '../stores/lastYearData.store';

// Use the store as the single source of truth for this component's state
const store = useLastYearDataStore();

onMounted(() => {
  // Tell the store to fetch data when the component is ready
  store.fetchLastYearData();
});
</script>

<style scoped>
.last-year-data-card {
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
  margin-top: 1rem;
}
.card-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
  margin-top: 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}
.loading-state, .error-state, .no-data-state {
  color: #666;
  font-style: italic;
}
.data-display .data-section {
  margin-bottom: 1rem;
}
.data-display h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.data-display ul {
  list-style-type: disc;
  padding-left: 20px;
  margin: 0;
  font-size: 0.9rem;
}
.data-display li {
  margin-bottom: 4px;
}
.error-state {
  color: #D32F2F; /* Red color for errors */
  border: 1px solid #FFCDD2;
  background-color: #FFEBEE;
  padding: 1rem;
  border-radius: 4px;
}
.error-title {
  margin: 0;
  font-weight: bold;
  font-size: 1.1rem;
}
.error-message {
  margin: 0.5rem 0 0 0;
}
</style> 