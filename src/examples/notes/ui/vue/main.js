import { createApp, defineAsyncComponent } from 'vue';
import '../editor.css';

createApp(defineAsyncComponent(() => import('./Editor.vue'))).mount('#app');
