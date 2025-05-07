import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
// import './css/App.css'
import { LinkButton } from "./components/test/link";


export function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <LinkButton text="Home" link="/home" />
        <LinkButton text="Search" link="/search" />
        <LinkButton text="Result" link="/result" />
        <LinkButton text="Favorite" link="/favorite" />
        <LinkButton text="Recommend" link="/recommend" />
        <LinkButton text="practice" link="/practice" />
        <LinkButton text="Auth" link="/auth" />
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
