import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)   // datos de Firestore
  const [cargando, setCargando] = useState(true)
  const [errorAuth, setErrorAuth] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid))
          if (snap.exists()) {
            const data = snap.data()
            setErrorAuth('')
            setUsuario({ id: snap.id, ...data, apellidos: data.apellidos || data.apellido || '' })
          } else {
            setErrorAuth('Usuario no encontrado en la base de datos (UID: ' + firebaseUser.uid + ')')
            setUsuario(null)
          }
        } catch (e) {
          console.error('Error leyendo usuario:', e)
          setErrorAuth('Error de conexión: ' + e.message)
          setUsuario(null)
        }
      } else {
        setUsuario(null)
      }
      setCargando(false)
    })
    return unsub
  }, [])

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, errorAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
