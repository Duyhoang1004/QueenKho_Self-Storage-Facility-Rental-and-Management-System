import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  searchFacilities,
  getFacilityAvailability,
  getAllUnitTypes,
  getCities,
} from '../../services/facilityService'

function formatVND(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export default function SearchResultsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters (đọc từ URL query params)
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '')
  const [selectedUnitType, setSelectedUnitType] = useState(searchParams.get('unitTypeId') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')

  // Data
  const [results, setResults] = useState([])
  const [unitTypes, setUnitTypes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const PAGE_SIZE = 12

  // Facility detail modal
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [facilityDetail, setFacilityDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Load filter options
  useEffect(() => {
    Promise.all([getAllUnitTypes(), getCities()]).then(([ut, ct]) => {
      setUnitTypes(ut)
      setCities(ct)
    })
  }, [])

  // Search khi params thay đổi
  useEffect(() => {
    performSearch()
  }, [searchParams])

  async function performSearch() {
    try {
      setLoading(true)
      const params = {}
      const kw = searchParams.get('keyword')
      const ct = searchParams.get('city')
      const ut = searchParams.get('unitTypeId')
      const minP = searchParams.get('minPrice')
      const maxP = searchParams.get('maxPrice')
      const facilityId = searchParams.get('facilityId')

      if (kw) params.keyword = kw
      if (ct) params.city = ct
      if (ut) params.unitTypeId = ut
      if (minP) params.minPrice = minP
      if (maxP) params.maxPrice = maxP
      params.page = page
      params.size = PAGE_SIZE

      // Nếu chọn trực tiếp 1 facility → xem availability detail
      if (facilityId && !kw && !ct && !ut) {
        const detail = await getFacilityAvailability(facilityId)
        // Chuyển availability thành dạng result items
        const items = detail.unitTypeAvailability
          .filter((slot) => slot.availableCount > 0)
          .map((slot) => ({
            facilityId: detail.facility.id,
            facilityName: detail.facility.name,
            city: detail.facility.city,
            district: detail.facility.district,
            address: detail.facility.address,
            hotline: detail.facility.hotline,
            unitTypeId: slot.unitTypeId,
            unitTypeName: slot.unitTypeName,
            areaSqm: slot.areaSqm,
            basePriceMonthly: slot.basePriceMonthly,
            dimensions: slot.dimensions,
            suggestedCapacity: slot.suggestedCapacity,
            features: slot.features,
            availableCount: slot.availableCount,
          }))
        setResults(items)
        setTotalElements(items.length)
        setTotalPages(1)
      } else {
        const data = await searchFacilities(params)
        setResults(data.content || [])
        setTotalElements(data.totalElements || 0)
        setTotalPages(data.totalPages || 0)
      }
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Áp dụng bộ lọc
  function applyFilters(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (selectedCity) params.set('city', selectedCity)
    if (selectedUnitType) params.set('unitTypeId', selectedUnitType)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    setPage(0)
    setSearchParams(params)
  }

  // Reset bộ lọc
  function resetFilters() {
    setKeyword('')
    setSelectedCity('')
    setSelectedUnitType('')
    setMinPrice('')
    setMaxPrice('')
    setPage(0)
    setSearchParams({})
  }

  // Xem chi tiết facility
  async function openFacilityDetail(facilityId) {
    try {
      setDetailLoading(true)
      setSelectedFacility(facilityId)
      const data = await getFacilityAvailability(facilityId)
      setFacilityDetail(data)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Đặt kho → chuyển sang CreateReservationPage
  function handleBooking(facilityId, unitTypeId) {
    navigate(`/booking?facilityId=${facilityId}&unitTypeId=${unitTypeId}`)
  }

  // Tên loại kho từ id
  function getUnitTypeName(id) {
    const ut = unitTypes.find((u) => u.id === Number(id))
    return ut ? ut.name : ''
  }

  // Mô tả tìm kiếm hiện tại
  function getSearchDescription() {
    const parts = []
    if (searchParams.get('keyword')) parts.push(`"${searchParams.get('keyword')}"`)
    if (searchParams.get('city')) parts.push(searchParams.get('city'))
    if (searchParams.get('unitTypeId')) parts.push(getUnitTypeName(searchParams.get('unitTypeId')))
    if (searchParams.get('facilityId')) parts.push('Chi nhánh cụ thể')
    return parts.length > 0 ? parts.join(' • ') : 'Tất cả kho khả dụng'
  }

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-[1180px] w-full mx-auto px-margin py-space-lg flex flex-col gap-space-lg">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 font-code-sm text-code-sm text-outline">
          <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/')}>Trang chủ</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-on-surface cursor-pointer" onClick={() => navigate('/tim-va-dat-kho')}>Tìm & Đặt Kho</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-on-surface font-semibold">Kết quả tìm kiếm</span>
        </div>

        {/* ═══════════════ FILTER BAR ═══════════════ */}
        <form
          onSubmit={applyFilters}
          className="bg-white border border-outline-variant/60 rounded-lg p-4 flex flex-col gap-3"
          style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 2px 4px -1px' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-title-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-secondary">filter_list</span>
              Bộ lọc tìm kiếm
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-label-sm font-label-sm text-outline hover:text-error flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
              Đặt lại
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Keyword */}
            <div className="sm:col-span-4 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tên cơ sở, quận, địa chỉ..."
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>

            {/* City */}
            <div className="sm:col-span-2 relative">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface appearance-none cursor-pointer focus:outline-none focus:border-secondary"
              >
                <option value="">Thành phố</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">expand_more</span>
            </div>

            {/* Unit Type */}
            <div className="sm:col-span-2 relative">
              <select
                value={selectedUnitType}
                onChange={(e) => setSelectedUnitType(e.target.value)}
                className="w-full pl-3 pr-8 py-2.5 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface appearance-none cursor-pointer focus:outline-none focus:border-secondary"
              >
                <option value="">Loại kho</option>
                {unitTypes.map((ut) => (
                  <option key={ut.id} value={ut.id}>{ut.name}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">expand_more</span>
            </div>

            {/* Min Price */}
            <div className="sm:col-span-1">
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Giá từ"
                className="w-full px-3 py-2.5 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>

            {/* Max Price */}
            <div className="sm:col-span-1">
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Giá đến"
                className="w-full px-3 py-2.5 rounded-lg border border-outline-variant text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary"
              />
            </div>

            {/* Search button */}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-secondary text-on-secondary rounded-lg font-title-md text-title-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
                Tìm
              </button>
            </div>
          </div>
        </form>

        {/* ═══════════════ RESULTS HEADER ═══════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-headline-md font-headline-md text-on-surface">
              Kết quả tìm kiếm
            </h1>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
              {getSearchDescription()} — {totalElements} kết quả
            </p>
          </div>
        </div>

        {/* ═══════════════ LOADING ═══════════════ */}
        {loading && (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px] animate-spin text-secondary">progress_activity</span>
            <p className="mt-2 text-body-md font-body-md">Đang tìm kiếm...</p>
          </div>
        )}

        {/* ═══════════════ EMPTY STATE ═══════════════ */}
        {!loading && results.length === 0 && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-outline/40">search_off</span>
            <h3 className="text-title-md font-title-md text-on-surface mt-3">
              Không tìm thấy kết quả
            </h3>
            <p className="text-body-sm font-body-sm text-on-surface-variant mt-1 max-w-md mx-auto">
              Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm. Có thể tất cả ô kho tại khu vực này đã được thuê hết.
            </p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-secondary text-on-secondary rounded-lg font-title-md text-title-md hover:opacity-90 cursor-pointer"
            >
              Xóa bộ lọc & thử lại
            </button>
          </div>
        )}

        {/* ═══════════════ RESULTS GRID ═══════════════ */}
        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {results.map((item, idx) => (
              <div
                key={`${item.facilityId}-${item.unitTypeId}-${idx}`}
                className="bg-white rounded-lg border border-outline-variant/60 overflow-hidden hover:shadow-md transition-all flex flex-col"
                style={{ boxShadow: 'rgba(0, 0, 0, 0.06) 0px 2px 4px -1px' }}
              >
                {/* Card header - Facility name */}
                <div className="bg-primary/5 px-4 py-3 border-b border-outline-variant/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-secondary">apartment</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-title-md font-title-md text-on-surface truncate">{item.facilityName}</h3>
                      <p className="text-label-sm font-label-sm text-on-surface-variant truncate">{item.district}, {item.city}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openFacilityDetail(item.facilityId)}
                    className="text-label-sm font-label-sm text-secondary hover:underline cursor-pointer flex-shrink-0"
                  >
                    Chi tiết
                  </button>
                </div>

                {/* Card body - Unit type info */}
                <div className="px-4 py-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm font-label-sm bg-primary-fixed text-primary px-2 py-0.5 rounded-full">
                      {item.unitTypeName}
                    </span>
                    <span className="text-label-sm font-label-sm text-on-surface-variant">
                      {item.areaSqm} m² • {item.dimensions}
                    </span>
                  </div>

                  {item.features && (
                    <p className="text-body-sm font-body-sm text-on-surface-variant">
                      {item.features}
                    </p>
                  )}

                  {item.suggestedCapacity && (
                    <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">package_2</span>
                      {item.suggestedCapacity}
                    </p>
                  )}

                  <p className="text-body-sm font-body-sm text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                    {item.address}
                  </p>
                </div>

                {/* Card footer - Price + CTA */}
                <div className="px-4 py-3 border-t border-outline-variant/40 flex items-center justify-between bg-white">
                  <div>
                    <span className="text-headline-sm font-headline-sm text-primary">
                      {formatVND(item.basePriceMonthly)}
                    </span>
                    <span className="text-body-sm font-body-sm text-on-surface-variant">/tháng</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-label-sm font-label-sm ${
                        item.availableCount > 2 ? 'text-[#10B981]' : 'text-[#D97706]'
                      }`}>
                        {item.availableCount} ô trống
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBooking(item.facilityId, item.unitTypeId)}
                    className="px-4 py-2 bg-secondary text-on-secondary rounded-lg font-title-md text-title-md hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                    Đặt kho
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════ PAGINATION ═══════════════ */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <button
              disabled={page === 0}
              onClick={() => {
                setPage(page - 1)
                const p = new URLSearchParams(searchParams)
                p.set('page', String(page - 1))
                setSearchParams(p)
              }}
              className="w-9 h-9 rounded-lg border border-outline-variant bg-white flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => {
                  setPage(i)
                  const p = new URLSearchParams(searchParams)
                  p.set('page', String(i))
                  setSearchParams(p)
                }}
                className={`w-9 h-9 rounded-lg font-title-md text-title-md cursor-pointer ${
                  i === page
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline-variant bg-white text-on-surface hover:bg-surface-container'
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={page >= totalPages - 1}
              onClick={() => {
                setPage(page + 1)
                const p = new URLSearchParams(searchParams)
                p.set('page', String(page + 1))
                setSearchParams(p)
              }}
              className="w-9 h-9 rounded-lg border border-outline-variant bg-white flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}

        {/* ═══════════════ FACILITY DETAIL MODAL ═══════════════ */}
        {selectedFacility && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => { setSelectedFacility(null); setFacilityDetail(null) }}
          >
            <div
              className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-[32px] animate-spin text-secondary">progress_activity</span>
                  <p className="mt-2 text-body-md font-body-md text-on-surface-variant">Đang tải...</p>
                </div>
              ) : facilityDetail ? (
                <>
                  {/* Modal header */}
                  <div className="px-5 py-4 border-b border-outline-variant/60 flex items-center justify-between"
                    style={{ background: 'linear-gradient(135deg, #002746 0%, #0b3d66 100%)' }}
                  >
                    <div>
                      <h3 className="text-title-md font-title-md text-on-primary">{facilityDetail.facility.name}</h3>
                      <p className="text-label-sm font-label-sm text-on-primary/70">
                        {facilityDetail.facility.address} • {facilityDetail.facility.district}, {facilityDetail.facility.city}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedFacility(null); setFacilityDetail(null) }}
                      className="text-on-primary/60 hover:text-on-primary cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                  </div>

                  {/* Modal body */}
                  <div className="p-5 flex flex-col gap-3">
                    <h4 className="text-title-md font-title-md text-on-surface">Loại kho khả dụng tại cơ sở</h4>

                    {facilityDetail.unitTypeAvailability.length === 0 ? (
                      <p className="text-body-sm font-body-sm text-on-surface-variant text-center py-4">
                        Hiện không có loại kho nào tại cơ sở này.
                      </p>
                    ) : (
                      facilityDetail.unitTypeAvailability.map((slot) => (
                        <div
                          key={slot.unitTypeId}
                          className="border border-outline-variant/60 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-title-md font-title-md text-on-surface">{slot.unitTypeName}</span>
                              <span className="text-label-sm font-label-sm text-on-surface-variant">{slot.areaSqm} m²</span>
                            </div>
                            <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                              {slot.dimensions} • {formatVND(slot.basePriceMonthly)}/tháng
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-label-sm font-label-sm text-on-surface-variant">
                                Tổng: {slot.totalUnits} ô
                              </span>
                              <span className={`text-label-sm font-label-sm font-semibold ${
                                slot.availableCount > 0 ? 'text-[#10B981]' : 'text-error'
                              }`}>
                                Còn trống: {slot.availableCount}
                              </span>
                            </div>
                          </div>
                          <button
                            disabled={slot.availableCount === 0}
                            onClick={() => handleBooking(facilityDetail.facility.id, slot.unitTypeId)}
                            className="px-3 py-2 bg-secondary text-on-secondary rounded-lg font-title-md text-title-md hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-default flex-shrink-0 ml-3"
                          >
                            Đặt kho
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
