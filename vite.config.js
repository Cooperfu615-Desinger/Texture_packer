import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// base 路徑必須與 GitHub repo 名稱一致（大小寫敏感）
// 部署到 https://<username>.github.io/Texture_packer/
export default defineConfig({
  plugins: [react()],
  base: '/Texture_packer/',
})
