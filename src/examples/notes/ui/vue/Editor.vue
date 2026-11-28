<script setup>
import { onMounted, onUnmounted, shallowRef } from 'vue';
import { edit, load, save, snapshot, subscribe } from '../editor.js';

const state = shallowRef(snapshot());
const unsubscribe = subscribe(() => { state.value = snapshot(); });
onMounted(load);
onUnmounted(unsubscribe);
</script>

<template>
  <main>
    <header><h1>笔记</h1><small aria-label="框架版本">{{ state.version && 'Noyau ' + state.version }}</small></header>
    <form @submit.prevent="save">
      <fieldset :disabled="!state.ready">
        <label for="title">标题</label>
        <input id="title" :value="state.title" @input="edit('title', $event.target.value)">
        <label for="body">正文</label>
        <textarea id="body" :value="state.body" @input="edit('body', $event.target.value)"></textarea>
      </fieldset>
      <footer>
        <output aria-live="polite">{{ state.status }}</output>
        <button type="submit" :disabled="!state.ready || state.saving">保存</button>
      </footer>
    </form>
  </main>
</template>
