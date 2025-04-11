"use client"

import { useState, useEffect } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/lib/auth-context"
import type { Motorcycle } from "@/lib/types"
import MotorcycleCard from "./motorcycle-card"
import LoginModal from "./login-modal"
import RegisterModal from "./register-modal"
import Pagination from "./pagination"

export default function MotorcycleSection() {
  const { user } = useAuth()
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [filteredMotorcycles, setFilteredMotorcycles] = useState<Motorcycle[]>([])
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  // Filter states
  const [manufacturerFilter, setManufacturerFilter] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [powerFilter, setPowerFilter] = useState("")
  const [speedFilter, setSpeedFilter] = useState("")
  const [sortOption, setSortOption] = useState("default")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(2) // Changed from 6 to 2

  useEffect(() => {
    fetchMotorcycles()
  }, [])

  useEffect(() => {
    filterAndSortMotorcycles()
  }, [motorcycles, manufacturerFilter, minPrice, maxPrice, powerFilter, speedFilter, sortOption])

  const fetchMotorcycles = async () => {
    try {
      const motorcyclesCollection = collection(db, "motors")
      const motorcyclesSnapshot = await getDocs(motorcyclesCollection)
      const motorcyclesList = motorcyclesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Motorcycle[]

      setMotorcycles(motorcyclesList)

      // Extract unique manufacturers
      const uniqueManufacturers = [...new Set(motorcyclesList.map((m) => m.manufacturer))].filter(Boolean)
      setManufacturers(uniqueManufacturers)
    } catch (error) {
      console.error("Error fetching motorcycles:", error)
    }
  }

  const filterAndSortMotorcycles = () => {
    let filtered: Motorcycle[] = [...motorcycles]

    // Apply manufacturer filter
    if (manufacturerFilter) {
      filtered = filtered.filter((m) => m.manufacturer === manufacturerFilter)
    }

    // Apply price filters
    if (minPrice) {
      filtered = filtered.filter((m) => {
        const price = Number.parseFloat(m.price.toString().replace(/[^\d.]/g, ""))
        return price >= Number.parseFloat(minPrice)
      })
    }

    if (maxPrice) {
      filtered = filtered.filter((m) => {
        const price = Number.parseFloat(m.price.toString().replace(/[^\d.]/g, ""))
        return price <= Number.parseFloat(maxPrice)
      })
    }

    // Apply power filter
    if (powerFilter) {
      const powerValue = Number.parseInt(powerFilter)
      if (powerValue === 301) {
        filtered = filtered.filter((m: Motorcycle) => Number(m.horsepower.toString()) > 300)
      } else {
        filtered = filtered.filter((m: Motorcycle) => Number(m.horsepower.toString()) <= powerValue)
      }
    }

    // Apply speed filter
    if (speedFilter) {
      const speedValue = Number.parseInt(speedFilter)
      if (speedValue === 251) {
        filtered = filtered.filter((m: Motorcycle) => Number(m.maxSpeed.toString()) > 250)
      } else {
        filtered = filtered.filter((m: Motorcycle) => Number(m.maxSpeed.toString()) <= speedValue)
      }
    }

    // Apply sorting
    switch (sortOption) {
      case "nameAsc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => a.name.localeCompare(b.name))
        break
      case "nameDesc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => b.name.localeCompare(a.name))
        break
      case "priceAsc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => {
          const priceA = Number.parseFloat(a.price.toString().replace(/[^\d.]/g, ""))
          const priceB = Number.parseFloat(b.price.toString().replace(/[^\d.]/g, ""))
          return priceA - priceB
        })
        break
      case "priceDesc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => {
          const priceA = Number.parseFloat(a.price.toString().replace(/[^\d.]/g, ""))
          const priceB = Number.parseFloat(b.price.toString().replace(/[^\d.]/g, ""))
          return priceB - priceA
        })
        break
      case "powerAsc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(a.horsepower.toString()) - Number(b.horsepower.toString()))
        break
      case "powerDesc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(b.horsepower.toString()) - Number(a.horsepower.toString()))
        break
      case "speedAsc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(a.maxSpeed.toString()) - Number(b.maxSpeed.toString()))
        break
      case "speedDesc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(b.maxSpeed.toString()) - Number(a.maxSpeed.toString()))
        break
      case "torqueAsc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(a.torque.toString()) - Number(b.torque.toString()))
        break
      case "torqueDesc":
        filtered.sort((a: Motorcycle, b: Motorcycle) => Number(b.torque.toString()) - Number(a.torque.toString()))
        break
    }

    setFilteredMotorcycles(filtered)
  }

  // Get current motorcycles for pagination
  const indexOfLastMotorcycle = currentPage * itemsPerPage
  const indexOfFirstMotorcycle = indexOfLastMotorcycle - itemsPerPage
  const currentMotorcycles = filteredMotorcycles.slice(indexOfFirstMotorcycle, indexOfLastMotorcycle)

  // Change page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  const handleApplyFilters = () => {
    filterAndSortMotorcycles()
  }

  const handleResetFilters = () => {
    setManufacturerFilter("")
    setMinPrice("")
    setMaxPrice("")
    setPowerFilter("")
    setSpeedFilter("")
    setSortOption("default")
  }

  const handlePurchase = (motorcycle: Motorcycle) => {
    if (!user) {
      setShowLoginModal(true)
      return
    }

    // Redirect to checkout or handle purchase logic
    console.log("Purchase motorcycle:", motorcycle)
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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [manufacturerFilter, minPrice, maxPrice, powerFilter, speedFilter, sortOption])

  return (
    <section id="motorcycles" className="py-16 bg-gray-50">
      <div className="container mx-auto px-6 md:px-8 lg:px-12">
        <h2 className="text-3xl font-bold text-center mb-12">Нашите мотоциклети</h2>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters */}
          <div className="lg:w-1/5">
            <div className="filter-card">
              <div className="filter-header">
                <h3>Филтри и сортиране</h3>
              </div>

              <div className="filter-group">
                <label className="block text-sm font-medium text-gray-600 mb-1">Сортирай по</label>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="default">По подразбиране</option>
                  <option value="nameAsc">Име (А-Я)</option>
                  <option value="nameDesc">Име (Я-А)</option>
                  <option value="priceAsc">Цена (ниска към висока)</option>
                  <option value="priceDesc">Цена (висока към ниска)</option>
                  <option value="powerAsc">Мощност (ниска към висока)</option>
                  <option value="powerDesc">Мощност (висока към ниска)</option>
                  <option value="speedAsc">Скорост (ниска към висока)</option>
                  <option value="speedDesc">Скорост (висока към ниска)</option>
                  <option value="torqueAsc">Въртящ момент (нисък към висок)</option>
                  <option value="torqueDesc">Въртящ момент (висок към нисък)</option>
                </select>
              </div>

              <hr className="my-4 border-gray-200" />

              <div className="filter-group">
                <label className="block text-sm font-medium text-gray-600 mb-1">Производител</label>
                <select
                  value={manufacturerFilter}
                  onChange={(e) => setManufacturerFilter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Всички</option>
                  {manufacturers.map((manufacturer) => (
                    <option key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="block text-sm font-medium text-gray-600 mb-1">Ценови диапазон</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Мин."
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Макс."
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label className="block text-sm font-medium text-gray-600 mb-1">Мощност</label>
                <select
                  value={powerFilter}
                  onChange={(e) => setPowerFilter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Всички</option>
                  <option value="100">До 100 hp</option>
                  <option value="200">100-200 hp</option>
                  <option value="300">200-300 hp</option>
                  <option value="301">Над 300 hp</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="block text-sm font-medium text-gray-600 mb-1">Максимална скорост</label>
                <select
                  value={speedFilter}
                  onChange={(e) => setSpeedFilter(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Всички</option>
                  <option value="150">До 150 км/ч</option>
                  <option value="200">150-200 км/ч</option>
                  <option value="250">200-250 км/ч</option>
                  <option value="251">Над 250 км/ч</option>
                </select>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 bg-black text-white py-2 px-4 rounded hover:bg-gray-800"
                >
                  Приложи
                </button>
                <button
                  onClick={handleResetFilters}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300"
                >
                  Изчисти
                </button>
              </div>
            </div>
          </div>

          {/* Motorcycles */}
          <div className="lg:w-4/5 lg:ml-auto">
            <div className="flex flex-col gap-6">
              {currentMotorcycles.length > 0 ? (
                currentMotorcycles.map((motorcycle) => (
                  <MotorcycleCard key={motorcycle.id} motorcycle={motorcycle} />
                ))
              ) : (
                <div className="bg-white p-8 rounded-lg text-center">
                  <p className="text-gray-500">Не са намерени мотори с избраните критерии.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredMotorcycles.length > 0 && (
              <div className="flex justify-center mt-8">
                <Pagination
                  itemsPerPage={2}
                  totalItems={filteredMotorcycles.length}
                  currentPage={currentPage}
                  paginate={paginate}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showLoginModal && <LoginModal onClose={closeModals} onSwitchToRegister={switchToRegister} />}
      {showRegisterModal && <RegisterModal onClose={closeModals} onSwitchToLogin={switchToLogin} />}
    </section>
  )
}
