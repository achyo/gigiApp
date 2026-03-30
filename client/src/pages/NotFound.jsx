import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)]">
      <span className="text-6xl">🔭</span>
      <h1 className="text-2xl font-black">Página no encontrada</h1>
      <p className="text-[var(--tx2)] text-sm">La dirección que buscas no existe.</p>
      <Button onClick={() => navigate('/')}>← Volver al inicio</Button>
    </div>
  );
}
