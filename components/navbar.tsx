"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import LoginModal from "./login-modal"
import RegisterModal from "./register-modal"

export default function Navbar() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setDisplayName(userData.displayName || user.email || 'User')
          } else {
            setDisplayName(user.email || 'User')
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          setDisplayName(user.email || 'User')
        }
      }

      fetchUserData()

      // Check if user is admin
      setIsAdmin(user.uid === "ZXduWaLnwuVPlKPvZm0FyoDeaXs2")
    }
  }, [user])

  useEffect(() => {
    if (isMenuOpen) {
      // Lock scroll but maintain position
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }

    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
    }
  }, [isMenuOpen])

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      closeMenu()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const openLoginModal = () => {
    setShowLoginModal(true)
    closeMenu()
  }

  const openRegisterModal = () => {
    setShowRegisterModal(true)
    closeMenu()
  }

  const closeModals = () => {
    setShowLoginModal(false)
    setShowRegisterModal(false)
  }

  const switchToRegister = () => {
    setShowLoginModal(false)
    setShowRegisterModal(true)
  }

  const switchToLogin = () => {
    setShowRegisterModal(false)
    setShowLoginModal(true)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-white text-2xl font-bold relative z-50">
            MotoWorld
          </Link>

          {/* Modern Burger Button */}
          <button
            className="lg:hidden relative w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-all duration-300 z-50"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <div className="relative w-6 h-4">
              <span
                className={`absolute left-0 top-0 h-0.5 rounded-full bg-white transition-all duration-300 ease-out origin-center ${
                  isMenuOpen 
                    ? "w-6 translate-y-[7px] rotate-45" 
                    : "w-6 translate-y-0 rotate-0"
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] h-0.5 bg-white rounded-full transition-all duration-300 ease-out ${
                  isMenuOpen ? "w-0 opacity-0" : "w-6 opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-[14px] h-0.5 rounded-full bg-white transition-all duration-300 ease-out origin-center ${
                  isMenuOpen 
                    ? "w-6 translate-y-[-7px] -rotate-45" 
                    : "w-6 translate-y-0 rotate-0"
                }`}
              />
            </div>
          </button>

          {/* Mobile Menu */}
          <div
            className={`fixed inset-0 z-[99] bg-black/95 backdrop-blur-md transform transition-all duration-300 ease-in-out ${
              isMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{
              height: '100dvh',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Content Container */}
            <div className="min-h-full flex flex-col">
              <div className="flex-1 pt-24 pb-8 px-6">
                <div className="max-w-lg mx-auto space-y-8">
                  {/* User Profile */}
                  {user && (
                    <div
                      className={`transform transition-all duration-500 ${
                        isMenuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                      }`}
                    >
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
                            <i className="fas fa-user text-white/80 text-xl" />
                          </div>
                          <div>
                            <p className="text-white/60 text-sm">Здравей,</p>
                            <p className="text-white font-medium text-lg truncate">{displayName}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Links */}
                  <nav className="grid gap-3">
                    {[
                      { href: "/", icon: "home", text: "Начало" },
                      { href: "/#motorcycles", icon: "motorcycle", text: "Нашите мотоциклети" },
                      { href: "/#about", icon: "info-circle", text: "За нас" },
                      { href: "/#contact", icon: "envelope", text: "Контакти" },
                    ].map((item, index) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        className={`group flex items-center gap-4 p-4 rounded-xl
                          border border-white/5 hover:border-white/20
                          bg-gradient-to-r from-white/5 to-transparent
                          hover:from-white/10 hover:to-white/5
                          transition-all duration-300 transform
                          ${isMenuOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}
                        `}
                        style={{ transitionDelay: `${150 + index * 50}ms` }}
                      >
                        <i
                          className={`fas fa-${item.icon} w-6 text-white/60 group-hover:text-white/90 transition-colors`}
                        />
                        <span className="text-white/90 group-hover:text-white font-medium">{item.text}</span>
                      </Link>
                    ))}

                    {/* Admin Links - Only show if user is admin */}
                    {user && isAdmin && (
                      <Link
                        href="/admin"
                        onClick={closeMenu}
                        className={`group flex items-center gap-4 p-4 rounded-xl
                          border border-white/5 hover:border-white/20
                          bg-gradient-to-r from-white/5 to-transparent
                          hover:from-white/10 hover:to-white/5
                          transition-all duration-300 transform
                          ${isMenuOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}
                        `}
                        style={{ transitionDelay: "350ms" }}
                      >
                        <div className="flex items-center gap-2">
                          <i className="fas fa-crown text-white/60 group-hover:text-white/90 transition-colors" />
                          <span className="text-white/90 group-hover:text-white font-medium">Админ център</span>
                        </div>
                      </Link>
                    )}
                  </nav>

                  {/* User Actions */}
                  <div
                    className={`transform transition-all duration-500 ${
                      isMenuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                    }`}
                    style={{ transitionDelay: "400ms" }}
                  >
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                      {user ? (
                        <>
                          <Link
                            href="/account"
                            onClick={closeMenu}
                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300"
                          >
                            <i className="fas fa-user-circle w-6 text-white/60" />
                            <span className="text-white/90">Акаунт</span>
                          </Link>
                          <Link
                            href="/cart"
                            onClick={closeMenu}
                            className="flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300"
                          >
                            <i className="fas fa-warehouse w-6 text-white/60" />
                            <span className="text-white/90">Гараж</span>
                          </Link>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-4 p-4 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-300"
                          >
                            <i className="fas fa-sign-out-alt w-6" />
                            <span>Излез</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={openLoginModal}
                            className="w-full p-4 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all duration-300"
                          >
                            <i className="fas fa-sign-in-alt mr-2" />
                            Вход
                          </button>
                          <button
                            onClick={openRegisterModal}
                            className="w-full p-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all duration-300"
                          >
                            <i className="fas fa-user-plus mr-2" />
                            Регистрация
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:block">
            <div className="h-full flex flex-col justify-center items-center lg:flex-row lg:justify-center">
              <ul className="flex flex-col lg:flex-row items-center space-y-6 lg:space-y-0 lg:space-x-8 lg:absolute lg:left-1/2 lg:transform lg:-translate-x-1/2">
                <li>
                  <Link
                    href="/"
                    className="text-white text-2xl lg:text-lg hover:text-gray-300 transition-colors"
                    onClick={closeMenu}
                  >
                    Начало
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#motorcycles"
                    className="text-white text-2xl lg:text-lg hover:text-gray-300 transition-colors"
                    onClick={closeMenu}
                  >
                    Нашите мотоциклети
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#about"
                    className="text-white text-2xl lg:text-lg hover:text-gray-300 transition-colors"
                    onClick={closeMenu}
                  >
                    За нас
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#contact"
                    className="text-white text-2xl lg:text-lg hover:text-gray-300 transition-colors"
                    onClick={closeMenu}
                  >
                    Контакти
                  </Link>
                </li>
              </ul>

              <div className="mt-8 lg:mt-0 lg:absolute lg:right-0">
                {user ? (
                  <div className="relative group">
                    <button className="flex items-center space-x-2 text-white text-xl lg:text-lg px-4 py-2 rounded hover:bg-white hover:bg-opacity-10">
                      <i className="fas fa-user"></i>
                      <span className="truncate max-w-[150px]">{displayName}</span>
                    </button>

                    <div className="absolute right-0 mt-2 w-48 bg-white bg-opacity-90 backdrop-blur-sm rounded-md shadow-lg overflow-hidden scale-0 group-hover:scale-100 origin-top-right transition-transform duration-200 z-50">
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                        onClick={closeMenu}
                      >
                        <i className="fas fa-user-circle mr-2"></i>
                        Акаунт
                      </Link>

                      <Link
                        href="/cart"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                        onClick={closeMenu}
                      >
                        <i className="fas fa-warehouse mr-2"></i>
                        Гараж
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="block px-4 py-2 text-gray-800 hover:bg-gray-100"
                          onClick={closeMenu}
                        >
                          <div className="flex items-center gap-2">
                            <i className="fas fa-crown"></i>
                            <span>Админ център</span>
                          </div>
                        </Link>
                      )}

                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                      >
                        <i className="fas fa-sign-out-alt mr-2"></i>
                        Излез
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative group">
                    <button className="flex items-center space-x-2 text-white text-xl lg:text-lg px-4 py-2 rounded hover:bg-white hover:bg-opacity-10">
                      <i className="fas fa-user"></i>
                      <span>Акаунт</span>
                    </button>

                    <div className="absolute right-0 mt-2 w-48 bg-white bg-opacity-90 backdrop-blur-sm rounded-md shadow-lg overflow-hidden scale-0 group-hover:scale-100 origin-top-right transition-transform duration-200 z-50">
                      <button
                        onClick={openLoginModal}
                        className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                      >
                        <i className="fas fa-sign-in-alt mr-2"></i>
                        Вход
                      </button>
                      <button
                        onClick={openRegisterModal}
                        className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                      >
                        <i className="fas fa-user-plus mr-2"></i>
                        Регистрация
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {showLoginModal && <LoginModal onClose={closeModals} onSwitchToRegister={switchToRegister} />}

      {showRegisterModal && <RegisterModal onClose={closeModals} onSwitchToLogin={switchToLogin} />}
    </>
  )
}
