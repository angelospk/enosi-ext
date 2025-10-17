<template>
  <transition-group
    name="list"
    tag="div"
    class="error-notification-container"
  >
    <div
      v-for="notification in visibleNotifications"
      :key="notification.id"
      class="notification-item"
    >
      <div class="icon">❗</div>
      <div class="content">
        <strong>Σφάλμα:</strong>
        <p>{{ notification.text }}</p>
      </div>
      <button
        title="Κλείσιμο"
        @click="dismiss(notification.id)"
      >
        ×
      </button>
    </div>
  </transition-group>
</template>
  
  <script setup lang="ts">
  import { ref } from 'vue';
  
  interface NotificationItem {
    id: string; // Use message ID
    text: string;
  }
  
  const visibleNotifications = ref<NotificationItem[]>([]);
  const MAX_NOTIFICATIONS = 3; // Μέγιστος αριθμός ειδοποιήσεων ταυτόχρονα
  
  function showErrorNotifications(errors: Array<{ id: string; text: string }>) {
    const now = Date.now();
    errors.forEach(err => {
      // Έλεγχος αν η ειδοποίηση υπάρχει ήδη για να μην την ξαναπροσθέσουμε
      if (!visibleNotifications.value.find(n => n.id === err.id)) {
        const newNotif = { ...err, displayId: `${err.id}-${now}` }; // Μοναδικό ID για την transition-group
  
        // Αν έχουμε φτάσει το όριο, αφαιρούμε την παλαιότερη
        if (visibleNotifications.value.length >= MAX_NOTIFICATIONS) {
          visibleNotifications.value.shift();
        }
        visibleNotifications.value.push(newNotif);
  
        setTimeout(() => {
          dismiss(newNotif.displayId);
        }, 7000); // Αυτόματη απόρριψη μετά από 7 δευτερόλεπτα
      }
    });
  }
  
  function dismiss(displayId: string) {
    visibleNotifications.value = visibleNotifications.value.filter(n => n.id !== displayId && (n as any).displayId !== displayId);
  }
  
  // Κάνουμε expose τη συνάρτηση για να μπορεί να κληθεί από το content script
  defineExpose({ showErrorNotifications });
  </script>
  
  <style scoped>
  .error-notification-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column-reverse; /* Οι νέες ειδοποιήσεις εμφανίζονται πάνω από τις παλιές */
    gap: 12px;
    z-index: 2147483647; /* Πάνω από όλα */
    width: 320px;
  }
  .notification-item {
    background-color: #ffebee;
    color: #b71c1c;
    padding: 12px 16px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: flex-start; /* Ευθυγράμμιση στην κορυφή για πολυγραμμικά μηνύματα */
    border-left: 4px solid #d32f2f;
    font-size: 0.9rem;
    animation: fadeIn 0.3s ease-out;
  }
  .notification-item .icon {
      font-size: 1.3em;
      margin-right: 10px;
      flex-shrink: 0;
      margin-top: 2px;
  }
  .notification-item .content {
      flex-grow: 1;
      word-break: break-word;
  }
  .notification-item .content strong {
      display: block;
      margin-bottom: 4px;
      font-weight: 600;
  }
  .notification-item .content p {
      margin: 0;
      line-height: 1.4;
  }
  
  .notification-item button {
    background: none;
    border: none;
    color: #c62828;
    font-size: 1.5em; /* Μεγαλύτερο Χ */
    cursor: pointer;
    margin-left: 12px;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
    align-self: flex-start; /* Στοίχιση του Χ στην κορυφή */
  }
  .notification-item button:hover {
    opacity: 1;
  }
  
  /* Animations for list items */
  .list-enter-active,
  .list-leave-active {
    transition: all 0.4s ease;
  }
  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateX(30px);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  </style>