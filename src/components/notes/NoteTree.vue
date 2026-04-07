<template>
  <div class="note">
    <p>{{ note.text }}</p>

    <!-- Appel récursif -->
    <div v-if="note.children && note.children.length" class="children">
      <NoteTree v-for="child in note.children" :key="child.id" :note="child" />
    </div>
  </div>
</template>

<script setup>
import NoteTree from './NoteTree.vue';

defineProps({
  note: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped>
.note {
  margin-left: 1rem;
  padding-left: 0.5rem;
  border-left: 2px solid #ddd;
}

.children {
  margin-top: 0.5rem;
}
</style>
