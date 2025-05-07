import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './css/index.css'
import { App }  from './App'
import { Home }  from './home'
import { Search }  from './search'
import { Result } from './result'
import { Favorite } from './favorite'
import { Recommend } from './recommend'
import { Practice } from './practice'
import { Auth } from './Auth'
import { BrowserRouter, Route, Routes } from "react-router-dom";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/result" element={<Result />} />
        <Route path="/favorite" element={<Favorite />} />
        <Route path="/recommend" element={<Recommend />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </BrowserRouter> 
    {/* <App /> */}
  </StrictMode>,
)
