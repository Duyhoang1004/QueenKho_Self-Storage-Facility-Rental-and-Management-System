import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFacilities, getAllUnitTypes, getCities } from '../../services/facilityService'

function formatVND(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export default function SearchLandingPage() {
  const navigate = useNavigate()

  const [keyword, setKeyword] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedUnitType, setSelectedUnitType] = useState('')

  const [facilities, setFacilities] = useState([])
  const [unitTypes, setUnitTypes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      setLoading(true)
      const [facilitiesData, unitTypesData, citiesData] = await Promise.all([
        getAllFacilities(),
        getAllUnitTypes(),
        getCities(),
      ])
      setFacilities(facilitiesData)
      setUnitTypes(unitTypesData)
      setCities(citiesData)
    } catch (err) {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (selectedCity) params.set('city', selectedCity)
    if (selectedUnitType) params.set('unitTypeId', selectedUnitType)
    navigate(`/tim-va-dat-kho/ket-qua?${params.toString()}`)
  }

  function handleSelectFacility(facilityId) {
    navigate(`/tim-va-dat-kho/ket-qua?facilityId=${facilityId}`)
  }

  function handleSelectUnitType(unitTypeId) {
    navigate(`/tim-va-dat-kho/ket-qua?unitTypeId=${unitTypeId}`)
  }

  return (
    <div className="flex flex-col w-full pb-20 bg-white select-none">
      <div className="max-w-[1040px] w-full mx-auto px-6 pt-8 flex flex-col gap-8">

        {/* BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
          <span className="text-[#58CC02] hover:text-[#58A700] cursor-pointer" onClick={() => navigate('/')}>Trang chủ</span>
          <span>/</span>
          <span className="text-[#4B4B4B]">Tìm & Đặt Kho</span>
        </div>

        {/* HEADER & TÌM KIẾM DUOLINGO FLAT */}
        <div className="duo-card p-6 space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <h1 className="text-2xl font-black text-[#4B4B4B] tracking-tight">
                Tìm khoang lưu trữ lý tưởng
              </h1>
            </div>
            <p className="text-xs font-bold text-[#AFAFAF] mt-1">
              Chọn chi nhánh gần bạn nhất và kích thước khoang kho phù hợp với nhu cầu.
            </p>
          </div>

          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
            <div className="sm:col-span-5 relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[#AFAFAF]">
                search
              </span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm khu vực, cơ sở (Q7, Cầu Giấy)..."
                className="duo-input w-full pl-11"
              />
            </div>

            <div className="sm:col-span-3 relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="duo-input w-full cursor-pointer appearance-none"
              >
                <option value="">Tất cả thành phố</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-[#AFAFAF] pointer-events-none">
                expand_more
              </span>
            </div>

            <div className="sm:col-span-3 relative">
              <select
                value={selectedUnitType}
                onChange={(e) => setSelectedUnitType(e.target.value)}
                className="duo-input w-full cursor-pointer appearance-none"
              >
                <option value="">Tất cả kích thước</option>
                {unitTypes.map((ut) => (
                  <option key={ut.id} value={ut.id}>{ut.name} ({ut.areaSqm}m²)</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-[#AFAFAF] pointer-events-none">
                expand_more
              </span>
            </div>

            <div className="sm:col-span-1">
              <button
                type="submit"
                className="duo-btn-green w-full h-full py-3 flex items-center justify-center cursor-pointer"
                title="Tìm kiếm"
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
              </button>
            </div>
          </form>
        </div>

        {/* LOADING & ERROR */}
        {loading && (
          <div className="text-center py-16 text-[#AFAFAF]">
            <span className="material-symbols-outlined text-[36px] animate-spin text-[#58CC02]">progress_activity</span>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider">Đang tải danh sách kho...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border-2 border-b-4 border-[#FFDFDF] bg-[#FFF5F5] text-[#FF4B4B] text-xs font-black p-4 text-center">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* DANH SÁCH LOẠI KHOANG */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  <h2 className="text-lg font-black uppercase tracking-wider text-[#4B4B4B]">
                    Kích thước khoang kho
                  </h2>
                </div>
                <span className="text-xs font-black uppercase text-[#1CB0F6] bg-[#DDF4FF] px-3 py-1 rounded-full border border-[#84D8FF]">
                  {unitTypes.length} phân loại
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {unitTypes.map((ut) => (
                  <button
                    key={ut.id}
                    onClick={() => handleSelectUnitType(ut.id)}
                    className="duo-card p-5 flex flex-col justify-between hover:border-[#58CC02] text-left cursor-pointer group transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider">{ut.dimensions}</span>
                        <span className="text-xs font-black text-[#58A700] bg-[#D7FFB8] border-2 border-[#58CC02] px-2.5 py-0.5 rounded-full uppercase">
                          {ut.areaSqm} m²
                        </span>
                      </div>
                      <h3 className="font-black text-lg text-[#4B4B4B] group-hover:text-[#58CC02] transition-colors">
                        {ut.name}
                      </h3>
                      <p className="text-xs font-bold text-[#AFAFAF] mt-1.5 line-clamp-2 leading-relaxed">
                        {ut.suggestedCapacity}
                      </p>
                    </div>

                    <div className="mt-5 pt-3 border-t-2 border-[#E5E5E5] flex items-center justify-between">
                      <span className="text-xs font-black text-[#AFAFAF] uppercase">Giá khởi điểm</span>
                      <span className="text-base font-black text-[#58CC02]">
                        {formatVND(ut.basePriceMonthly)}/tháng
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* DANH SÁCH CHI NHÁNH */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏢</span>
                  <h2 className="text-lg font-black uppercase tracking-wider text-[#4B4B4B]">
                    Hệ thống chi nhánh QueenKho
                  </h2>
                </div>
                <span className="text-xs font-black uppercase text-[#58A700] bg-[#D7FFB8] px-3 py-1 rounded-full border border-[#58CC02]">
                  {facilities.length} chi nhánh
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFacility(f.id)}
                    className="duo-card p-5 flex flex-col justify-between hover:border-[#1CB0F6] text-left cursor-pointer group transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-black text-lg text-[#4B4B4B] group-hover:text-[#1CB0F6] transition-colors">
                          {f.name}
                        </h3>
                        <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase border-2 ${
                          f.totalAvailableUnits > 0
                            ? 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]'
                            : 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]'
                        }`}>
                          {f.totalAvailableUnits > 0 ? `Còn ${f.totalAvailableUnits} ô` : 'Hết ô'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#AFAFAF] mt-1">{f.address} • {f.district}, {f.city}</p>
                    </div>

                    <div className="mt-5 pt-3 border-t-2 border-[#E5E5E5] flex items-center justify-between text-xs font-black">
                      <span className="text-[#AFAFAF]">Hotline: {f.hotline || '1900 6868'}</span>
                      <span className="text-[#1CB0F6] group-hover:translate-x-1 transition-transform flex items-center gap-1 uppercase tracking-wider">
                        <span>XEM KHO</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
