<template>
  <div>
    <RouterLinkUp />

    <h1>Βοήθεια & Υποστήριξη</h1>
    <p>
      Αν χρειάζεστε βοήθεια; Είμαστε εδώ για να σε βοηθήσουμε! Για κάθε πρόβλημα ή ερώτηση, μπορείτε να επικοινωνήσετε με την ομάδα υποστήριξης μας:
      <a
        href="mailto:angelos.papamichail@gmail.com"
        class="btn-link"
      >
        angelos.papamichail@gmail.com
      </a>  
    </p>



    <div class="flex gap-2">
      <RouterLink to="/common/about">Σχετικά με εμάς</RouterLink>

      <RouterLink to="/common/privacy-policy">Πολιτική Απορρήτου</RouterLink>

      <RouterLink to="/common/terms-of-service">Όροι Χρήσης</RouterLink>
    </div>
  </div>
</template>
