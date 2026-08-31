import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import Login from "./components/Login.jsx";
import Layout from "./components/Layout.jsx";
import OrdersTable from "./components/OrdersTable.jsx";
import ProductManager from "./components/ProductManager.jsx";
import ClientManager from "./components/ClientManager.jsx";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    if (session) {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", session.user.id)
        .single();

      if (existingProfile?.role === "staff") {
        setProfile(existingProfile);
      } else {
        await supabase.auth.signOut();
      }
    }
    setCheckingSession(false);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-ink-950 text-slate-400 text-sm">
        Verifica sessione in corso...
      </div>
    );
  }

  if (!profile) {
    return <Login onLoginSuccess={setProfile} />;
  }

  return (
    <Layout profile={profile} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "orders" && <OrdersTable />}
      {activeTab === "products" && <ProductManager />}
      {activeTab === "clients" && <ClientManager />}
    </Layout>
  );
}
