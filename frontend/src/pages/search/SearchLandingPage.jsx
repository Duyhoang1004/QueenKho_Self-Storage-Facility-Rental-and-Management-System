import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllFacilities, getAllUnitTypes, getCities } from '../../services/facilityService'

function formatVND(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export default function SearchLandingPage() {
  const navigate = useNavigate()

  // States cho search form
  const [keyword, setKeyword] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedUnitType, setSelectedUnitType] = useState('')

  // States cho data
  const [facilities, setFacilities] = useState([])
  const [unitTypes, setUnitTypes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Load dữ liệu khi trang mở
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

  // Xử lý tìm kiếm
  function handleSearch(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (selectedCity) params.set('city', selectedCity)
    if (selectedUnitType) params.set('unitTypeId', selectedUnitType)
    navigate(`/tim-va-dat-kho/ket-qua?${params.toString()}`)
  }

  // Chọn nhanh một cơ sở → xem chi tiết availability
  function handleSelectFacility(facilityId) {
    navigate(`/tim-va-dat-kho/ket-qua?facilityId=${facilityId}`)
  }

  // Chọn nhanh một loại kho → tìm tất cả cơ sở có loại đó
  function handleSelectUnitType(unitTypeId) {
    navigate(`/tim-va-dat-kho/ket-qua?unitTypeId=${unitTypeId}`)
  }

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/')}>Trang chủ</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-semibold">Tìm & Đặt Kho</span>
        </div>

        {/* ═══════════════ HERO SECTION ═══════════════ */}
        <div
          className="rounded-lg p-8 flex flex-col items-center text-center gap-5"
          style={{
            background: 'linear-gradient(135deg, #002746 0%, #0b3d66 50%, #1d4973 100%)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-secondary text-[24px]">warehouse</span>
            </div>
            <h1 className="text-display-lg font-display-lg text-on-primary tracking-tight">
              Tìm Kho Lưu Trữ
            </h1>
          </div>
          <p className="text-body-md font-body-md text-on-primary/70 max-w-xl">
            Khám phá hệ thống kho tự quản 24/7 an toàn, hiện đại. Chọn loại kho và chi nhánh phù hợp với nhu cầu của bạn.
          </p>

          {/* ── SEARCH BAR ── */}
          <form onSubmit={handleSearch} className="w-full max-w-3xl">
            <div className="bg-white rounded-xl p-4 flex flex-col sm:flex-row gap-3 shadow-lg">
              {/* Keyword input */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline">search</span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm theo khu vực, tên cơ sở..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/30"
                />
              </div>

              {/* City dropdown */}
              <div className="relative sm:w-44">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">location_on</span>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface appearance-none cursor-pointer focus:outline-none focus:border-secondary"
                >
                  <option value="">Tất cả TP</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">expand_more</span>
              </div>

              {/* UnitType dropdown */}
              <div className="relative sm:w-52">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">inventory_2</span>
                <select
                  value={selectedUnitType}
                  onChange={(e) => setSelectedUnitType(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface appearance-none cursor-pointer focus:outline-none focus:border-secondary"
                >
                  <option value="">Tất cả loại kho</option>
                  {unitTypes.map((ut) => (
                    <option key={ut.id} value={ut.id}>{ut.name} ({ut.areaSqm} m²)</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">expand_more</span>
              </div>

              {/* Search button */}
              <button
                type="submit"
                className="px-6 py-3 bg-secondary text-on-secondary rounded-lg font-title-md text-title-md hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
                Tìm kiếm
              </button>
            </div>
          </form>

          {/* Quick stats */}
          <div className="flex items-center gap-6 text-on-primary/60 text-label-sm font-label-sm">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">apartment</span>
              <span>{facilities.length} cơ sở</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">category</span>
              <span>{unitTypes.length} loại kho</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Bảo vệ 3 lớp • CCTV 24/7</span>
            </div>
          </div>
        </div>

        {/* ═══════════════ LOADING / ERROR ═══════════════ */}
        {loading && (
          <div className="text-center py-12 text-on-surface-variant text-body-md font-body-md">
            <span className="material-symbols-outlined text-[32px] animate-spin text-secondary">progress_activity</span>
            <p className="mt-2">Đang tải dữ liệu...</p>
          </div>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container text-body-sm font-body-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ═══════════════ DANH SÁCH LOẠI KHO ═══════════════ */}
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <h2 className="text-headline-sm font-headline-sm text-on-surface">
                  Chọn loại kho phù hợp
                </h2>
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  {unitTypes.length} phân loại kích thước
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {unitTypes.map((ut) => (
                  <button
                    key={ut.id}
                    onClick={() => handleSelectUnitType(ut.id)}
                    className="bg-white rounded-lg border border-outline-variant/60 p-5 flex flex-col gap-3 hover:border-secondary/40 hover:shadow-md transition-all text-left cursor-pointer group"
                    style={{
                      boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px -1px',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center">
                          <span className="material-symbols-outlined text-[22px] text-primary">inventory_2</span>
                        </div>
                        <div>
                          <h3 className="text-title-md font-title-md text-on-surface group-hover:text-secondary transition-colors">
                            {ut.name}
                          </h3>
                          <p className="text-label-sm font-label-sm text-on-surface-variant">{ut.dimensions}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary group-hover:translate-x-1 transition-all">
                        arrow_forward
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-body-sm font-body-sm text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">straighten</span>
                        {ut.areaSqm} m²
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">deployed_code</span>
                        {ut.volumeCbm} m³
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-outline-variant/40 pt-3">
                      <span className="text-body-sm font-body-sm text-on-surface-variant">
                        {ut.suggestedCapacity}
                      </span>
                      <span className="text-title-md font-title-md text-secondary font-bold">
                        {formatVND(ut.basePriceMonthly)}<span className="text-body-sm font-normal text-on-surface-variant">/th</span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ═══════════════ DANH SÁCH CƠ SỞ ═══════════════ */}
            <div>
              <div className="flex items-center justify-between mb-space-md">
                <h2 className="text-headline-sm font-headline-sm text-on-surface">
                  Chi nhánh QueenKho
                </h2>
                <span className="text-body-sm font-body-sm text-on-surface-variant">
                  {facilities.length} cơ sở đang hoạt động
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
                {facilities.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFacility(f.id)}
                    className="bg-white rounded-lg border border-outline-variant/60 p-5 flex flex-col gap-3 hover:border-secondary/40 hover:shadow-md transition-all text-left cursor-pointer group"
                    style={{
                      boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px -1px',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center">
                          <span className="material-symbols-outlined text-[22px] text-secondary">apartment</span>
                        </div>
                        <div>
                          <h3 className="text-title-md font-title-md text-on-surface group-hover:text-secondary transition-colors">
                            {f.name}
                          </h3>
                          <p className="text-label-sm font-label-sm text-on-surface-variant">{f.district}, {f.city}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-secondary group-hover:translate-x-1 transition-all">
                        arrow_forward
                      </span>
                    </div>

                    <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {f.address}
                    </p>

                    <div className="flex items-center justify-between border-t border-outline-variant/40 pt-3">
                      <span className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">call</span>
                        {f.hotline || 'N/A'}
                      </span>
                      <span className={`text-label-sm font-label-sm px-2.5 py-1 rounded-full ${
                        f.totalAvailableUnits > 0
                          ? 'bg-[#ECFDF5] text-[#10B981] border border-[#10B981]/30'
                          : 'bg-error-container text-error border border-error/30'
                      }`}>
                        {f.totalAvailableUnits > 0 ? `${f.totalAvailableUnits} ô trống` : 'Hết chỗ'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ═══════════════ CTA BANNER ═══════════════ */}
            <div
              className="rounded-lg p-space-md flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #dbe1ff 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px] text-[#10B981]">local_offer</span>
                </div>
                <div>
                  <h4 className="text-title-md font-title-md text-on-surface">
                    Ưu đãi khách hàng mới
                  </h4>
                  <p className="text-body-sm font-body-sm text-on-surface-variant">
                    Giảm ngay 100.000đ cho đơn đầu tiên. Chiết khấu thêm 5–15% cho kỳ dài hạn.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-label-sm font-label-sm bg-white text-[#10B981] px-3 py-1.5 rounded-full border border-[#10B981]/20 font-semibold">
                  NEWKHO100K
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
