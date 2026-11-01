
import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import { useSelector } from 'react-redux';
import useFetchMe from './hooks/useFetchMe';
import CreateAgent from './pages/CreateAgent';
import Agents from './pages/Agents';
import Integrations from './pages/Integration';
import Pricing from './pages/Pricing';

function App() {
  useFetchMe();

  const { user, loading, error } = useSelector(
    (state) => state.auth
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e12] text-zinc-400">
        Loading your account...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e12] p-4 text-red-400">
        {error}
      </div>
    );
  }
  return (
    <>
    <BrowserRouter>
    <Routes>
       <Route
        path="/login"
        element={
          user ? <Home user={user} /> : <Login />
        }
      />

      <Route
        path="/agents/new"
        element={
          user ? <CreateAgent user={user} /> : <Login />
        }
      />
       <Route
        path="/agents"
        element={
          user ? <Agents user={user} /> : <Login />
        }
      />
       <Route
        path="/integrations"
        element={
          user ? <Integrations user={user} /> : <Login />
        }
      />
       <Route
        path="/pricing"
        element={
          user ? <Pricing user={user} /> : <Login />
        }
      />
      <Route
        path="/"
        element={
          user ? <Home user={user} /> : <Login />
        }
      />
    </Routes>
    </BrowserRouter>
    </>
  )
}

export default App
