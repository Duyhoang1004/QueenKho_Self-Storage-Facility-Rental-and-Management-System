import { useState, useEffect, useMemo } from 'react'
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

  // Dropdown Popover state
  const [openDropdown, setOpenDropdown] = useState(null)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [selectedFeatures, setSelectedFeatures] = useState([])
  const [sortOption, setSortOption] = useState('hot')

  // Data
  const [results, setResults] = useState([])
  const [unitTypes, setUnitTypes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 12

  // Facility detail modal
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [facilityDetail, setFacilityDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const featureOptions = [
    'Bảo mật vân tay',
    'Kháng nước, kháng bụi',
    'Điều hòa 20°C',
    'CCTV 24/7 AI',
    'Tầng trệt ô tô vào tận cửa',
    'Gần thang hàng',
    'Bảo hiểm 500 triệu',
  ]

  useEffect(() => {
    Promise.all([getAllUnitTypes(), getCities()]).then(([ut, ct]) => {
      setUnitTypes(ut)
      setCities(ct)
    })
  }, [])

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

      if (facilityId && !kw && !ct && !ut) {
        const detail = await getFacilityAvailability(facilityId)
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
      } else {
        const data = await searchFacilities(params)
        setResults(data.content || [])
        setTotalElements(data.totalElements || 0)
      }
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function applyFilters(newValues = {}) {
    const params = new URLSearchParams()
    const kw = newValues.keyword !== undefined ? newValues.keyword : keyword
    const ct = newValues.city !== undefined ? newValues.city : selectedCity
    const ut = newValues.unitTypeId !== undefined ? newValues.unitTypeId : selectedUnitType
    const minP = newValues.minPrice !== undefined ? newValues.minPrice : minPrice
    const maxP = newValues.maxPrice !== undefined ? newValues.maxPrice : maxPrice

    if (kw && kw.trim()) params.set('keyword', kw.trim())
    if (ct) params.set('city', ct)
    if (ut) params.set('unitTypeId', ut)
    if (minP) params.set('minPrice', minP)
    if (maxP) params.set('maxPrice', maxP)
    
    setPage(0)
    setSearchParams(params)
    setOpenDropdown(null)
  }

  function resetFilters() {
    setKeyword('')
    setSelectedCity('')
    setSelectedUnitType('')
    setMinPrice('')
    setMaxPrice('')
    setOnlyAvailable(false)
    setSelectedFeatures([])
    setSortOption('hot')
    setPage(0)
    setSearchParams({})
    setOpenDropdown(null)
  }

  function toggleFeature(feat) {
    if (selectedFeatures.includes(feat)) {
      setSelectedFeatures(selectedFeatures.filter((f) => f !== feat))
    } else {
      setSelectedFeatures([...selectedFeatures, feat])
    }
  }

  const filteredAndSortedResults = useMemo(() => {
    let list = [...results]

    if (onlyAvailable) {
      list = list.filter((item) => item.availableCount > 0)
    }

    if (selectedFeatures.length > 0) {
      list = list.filter((item) => {
        const featText = (item.features || '') + (item.suggestedCapacity || '') + (item.unitTypeName || '')
        return selectedFeatures.some((sf) => featText.toLowerCase().includes(sf.toLowerCase().slice(0, 5)))
      })
    }

    if (sortOption === 'price_asc') {
      list.sort((a, b) => a.basePriceMonthly - b.basePriceMonthly)
    } else if (sortOption === 'price_desc') {
      list.sort((a, b) => b.basePriceMonthly - a.basePriceMonthly)
    } else if (sortOption === 'area_desc') {
      list.sort((a, b) => (b.areaSqm || 0) - (a.areaSqm || 0))
    }

    return list
  }, [results, onlyAvailable, selectedFeatures, sortOption])

  function handleBooking(facilityId, unitTypeId) {
    navigate(`/booking?facilityId=${facilityId}&unitTypeId=${unitTypeId}`)
  }

  function getUnitTypeName(id) {
    const ut = unitTypes.find((u) => u.id === Number(id))
    return ut ? ut.name : ''
  }

  const activeFilterCount = [
    Boolean(keyword),
    Boolean(selectedCity),
    Boolean(selectedUnitType),
    Boolean(minPrice || maxPrice),
    onlyAvailable,
    selectedFeatures.length > 0,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col w-full pb-20 bg-white select-none">
      <div className="max-w-[1040px] w-full mx-auto px-6 pt-8 flex flex-col gap-6">

        {/* 1. BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#AFAFAF]">
          <span className="text-[#58CC02] hover:text-[#58A700] cursor-pointer" onClick={() => navigate('/')}>Trang chủ</span>
          <span>/</span>
          <span className="text-[#58CC02] hover:text-[#58A700] cursor-pointer" onClick={() => navigate('/tim-va-dat-kho')}>Tìm & Đặt Kho</span>
          <span>/</span>
          <span className="text-[#4B4B4B]">Kết quả tìm kiếm</span>
        </div>

        {/* 2. KHỐI TÌM KIẾM & BỘ LỌC DUOLINGO FLAT */}
        <div className="duo-card p-6 space-y-5">
          
          {/* Thanh input tìm kiếm */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              applyFilters()
            }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#AFAFAF]">
                search
              </span>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm kho theo quận, cơ sở, địa chỉ..."
                className="duo-input w-full pl-11"
              />
            </div>
            <button
              type="submit"
              className="duo-btn-green px-6 py-3 text-xs tracking-wider"
            >
              TÌM KIẾM
            </button>
          </form>

          <div className="h-[2px] bg-[#E5E5E5]"></div>

          {/* Tiêu đề & Chips Bộ lọc Duolingo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider">
                CHỌN THEO TIÊU CHÍ LỌC
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-black uppercase text-[#FF4B4B] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  <span>XÓA BỘ LỌC ({activeFilterCount})</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 relative">
              
              {/* Nút 1: [Bộ lọc] */}
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'all' ? null : 'all')}
                className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                  activeFilterCount > 0
                    ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                    : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">filter_alt</span>
                <span>Bộ lọc {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
              </button>

              {/* Nút 2: [Sẵn hàng] */}
              <button
                type="button"
                onClick={() => setOnlyAvailable(!onlyAvailable)}
                className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                  onlyAvailable
                    ? 'bg-[#D7FFB8] border-2 border-b-4 border-[#58A700] text-[#58A700]'
                    : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] mr-1">check_circle</span>
                <span>Còn trống</span>
              </button>

              {/* Nút 3: [Kho đạt chuẩn] */}
              <button
                type="button"
                onClick={() => setSortOption('hot')}
                className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                  sortOption === 'hot'
                    ? 'bg-[#FFE8CC] border-2 border-b-4 border-[#E58800] text-[#E58800]'
                    : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                }`}
              >
                <span className="text-sm mr-1">🔥</span>
                <span>Hot nhất</span>
              </button>

              {/* Nút 4: [Xem theo giá v] */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'price' ? null : 'price')}
                  className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                    minPrice || maxPrice || openDropdown === 'price'
                      ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                      : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">payments</span>
                  <span>
                    {minPrice || maxPrice ? `Giá: ${minPrice ? minPrice / 1000 + 'k' : '0'} - ${maxPrice ? maxPrice / 1000 + 'k' : '...'}` : 'Mức giá'}
                  </span>
                  <span className="material-symbols-outlined text-[16px] ml-1">expand_more</span>
                </button>

                {openDropdown === 'price' && (
                  <div className="absolute left-0 top-full mt-3 w-80 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl p-5 z-40">
                    <p className="text-xs font-black uppercase text-[#4B4B4B] mb-3">Chọn khoảng giá thuê:</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => { setMinPrice(''); setMaxPrice('500000'); applyFilters({ minPrice: '', maxPrice: '500000' }) }}
                        className="duo-btn-gray py-2 text-xs rounded-xl"
                      >
                        Dưới 500k
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMinPrice('500000'); setMaxPrice('1000000'); applyFilters({ minPrice: '500000', maxPrice: '1000000' }) }}
                        className="duo-btn-gray py-2 text-xs rounded-xl"
                      >
                        500k - 1 triệu
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMinPrice('1000000'); setMaxPrice('2000000'); applyFilters({ minPrice: '1000000', maxPrice: '2000000' }) }}
                        className="duo-btn-gray py-2 text-xs rounded-xl"
                      >
                        1 - 2 triệu
                      </button>
                      <button
                        type="button"
                        onClick={() => { setMinPrice('2000000'); setMaxPrice(''); applyFilters({ minPrice: '2000000', maxPrice: '' }) }}
                        className="duo-btn-gray py-2 text-xs rounded-xl"
                      >
                        Trên 2 triệu
                      </button>
                    </div>
                    <div className="flex gap-2 pt-3 border-t-2 border-[#E5E5E5]">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(null)}
                        className="duo-btn-gray flex-1 py-2 text-xs rounded-xl"
                      >
                        ĐÓNG
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFilters()}
                        className="duo-btn-green flex-1 py-2 text-xs rounded-xl"
                      >
                        ÁP DỤNG
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Nút 5: [Khu vực / Thành phố v] */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'city' ? null : 'city')}
                  className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                    selectedCity || openDropdown === 'city'
                      ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                      : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">location_on</span>
                  <span>{selectedCity || 'Khu vực'}</span>
                  <span className="material-symbols-outlined text-[16px] ml-1">expand_more</span>
                </button>

                {openDropdown === 'city' && (
                  <div className="absolute left-0 top-full mt-3 w-72 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl p-5 z-40">
                    <p className="text-xs font-black uppercase text-[#4B4B4B] mb-3">Chọn thành phố:</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => { setSelectedCity(''); applyFilters({ city: '' }) }}
                        className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                          !selectedCity ? 'bg-[#58CC02] border-b-2 border-[#58A700] text-white' : 'duo-btn-gray'
                        }`}
                      >
                        Tất cả
                      </button>
                      {cities.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setSelectedCity(c); applyFilters({ city: c }) }}
                          className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                            selectedCity === c ? 'bg-[#58CC02] border-b-2 border-[#58A700] text-white' : 'duo-btn-gray'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(null)}
                      className="duo-btn-gray w-full py-2 text-xs rounded-xl"
                    >
                      ĐÓNG
                    </button>
                  </div>
                )}
              </div>

              {/* Nút 6: [Loại khoang v] */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'unitType' ? null : 'unitType')}
                  className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                    selectedUnitType || openDropdown === 'unitType'
                      ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                      : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">inventory_2</span>
                  <span>{selectedUnitType ? getUnitTypeName(selectedUnitType) : 'Kích thước'}</span>
                  <span className="material-symbols-outlined text-[16px] ml-1">expand_more</span>
                </button>

                {openDropdown === 'unitType' && (
                  <div className="absolute left-0 top-full mt-3 w-84 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl p-5 z-40">
                    <p className="text-xs font-black uppercase text-[#4B4B4B] mb-3">Kích thước khoang:</p>
                    <div className="flex flex-col gap-1.5 mb-4 max-h-52 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => { setSelectedUnitType(''); applyFilters({ unitTypeId: '' }) }}
                        className={`text-left text-xs font-bold px-3 py-2 rounded-xl border-2 transition ${
                          !selectedUnitType ? 'bg-[#58CC02] border-[#58A700] text-white' : 'bg-white border-[#E5E5E5] text-[#4B4B4B]'
                        }`}
                      >
                        Tất cả loại kho
                      </button>
                      {unitTypes.map((ut) => (
                        <button
                          key={ut.id}
                          type="button"
                          onClick={() => { setSelectedUnitType(String(ut.id)); applyFilters({ unitTypeId: String(ut.id) }) }}
                          className={`text-left text-xs font-bold px-3 py-2 rounded-xl border-2 transition flex items-center justify-between ${
                            String(selectedUnitType) === String(ut.id)
                              ? 'bg-[#58CC02] border-[#58A700] text-white'
                              : 'bg-white border-[#E5E5E5] text-[#4B4B4B] hover:border-[#1CB0F6]'
                          }`}
                        >
                          <span>{ut.name} ({ut.areaSqm}m²)</span>
                          <span className="font-black">{formatVND(ut.basePriceMonthly)}/th</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(null)}
                      className="duo-btn-gray w-full py-2 text-xs rounded-xl"
                    >
                      ĐÓNG
                    </button>
                  </div>
                )}
              </div>

              {/* Nút 7: [Tính năng đặc biệt v] */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'features' ? null : 'features')}
                  className={`duo-btn px-4 py-2 text-xs rounded-2xl ${
                    selectedFeatures.length > 0 || openDropdown === 'features'
                      ? 'bg-[#DDF4FF] border-2 border-b-4 border-[#1899D6] text-[#1CB0F6]'
                      : 'bg-white border-2 border-b-4 border-[#E5E5E5] text-[#4B4B4B] hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">stars</span>
                  <span>
                    Tính năng {selectedFeatures.length > 0 ? `(${selectedFeatures.length})` : ''}
                  </span>
                  <span className="material-symbols-outlined text-[16px] ml-1">expand_more</span>
                </button>

                {openDropdown === 'features' && (
                  <div className="absolute left-0 top-full mt-3 w-84 sm:w-96 bg-white rounded-2xl border-2 border-b-4 border-[#E5E5E5] shadow-xl p-5 z-40">
                    <p className="text-xs font-black uppercase text-[#4B4B4B] mb-3">
                      Chọn tiện ích đi kèm:
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {featureOptions.map((feat) => {
                        const isSelected = selectedFeatures.includes(feat)
                        return (
                          <button
                            key={feat}
                            type="button"
                            onClick={() => toggleFeature(feat)}
                            className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                              isSelected
                                ? 'bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700]'
                                : 'duo-btn-gray'
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-[14px] mr-1 text-[#58CC02]">check</span>
                            )}
                            <span>{feat}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t-2 border-[#E5E5E5]">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(null)}
                        className="duo-btn-gray w-full py-2 text-xs rounded-xl"
                      >
                        ĐÓNG
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(null)}
                        className="duo-btn-green w-full py-2 text-xs rounded-xl"
                      >
                        XONG
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="h-[2px] bg-[#E5E5E5]"></div>

          {/* Sắp xếp theo */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase text-[#AFAFAF] shrink-0">
              Sắp xếp theo:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSortOption('hot')}
                className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                  sortOption === 'hot'
                    ? 'bg-[#FFE8CC] border-2 border-[#FF9600] text-[#E58800]'
                    : 'duo-btn-gray'
                }`}
              >
                Hot nhất
              </button>

              <button
                type="button"
                onClick={() => setSortOption('price_asc')}
                className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                  sortOption === 'price_asc'
                    ? 'bg-[#DDF4FF] border-2 border-[#1CB0F6] text-[#1899D6]'
                    : 'duo-btn-gray'
                }`}
              >
                Giá Thấp - Cao
              </button>

              <button
                type="button"
                onClick={() => setSortOption('price_desc')}
                className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                  sortOption === 'price_desc'
                    ? 'bg-[#DDF4FF] border-2 border-[#1CB0F6] text-[#1899D6]'
                    : 'duo-btn-gray'
                }`}
              >
                Giá Cao - Thấp
              </button>

              <button
                type="button"
                onClick={() => setSortOption('area_desc')}
                className={`duo-btn px-3 py-1.5 text-xs rounded-xl ${
                  sortOption === 'area_desc'
                    ? 'bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700]'
                    : 'duo-btn-gray'
                }`}
              >
                Diện tích lớn nhất
              </button>
            </div>
          </div>

        </div>

        {/* 3. RESULTS HEADER & COUNT */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-wider text-[#4B4B4B]">
            Khoang kho khả dụng ({filteredAndSortedResults.length})
          </h2>
        </div>

        {/* 4. LOADING SPINNER */}
        {loading && (
          <div className="text-center py-20 text-[#AFAFAF]">
            <span className="material-symbols-outlined text-[40px] animate-spin text-[#58CC02]">progress_activity</span>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider">Đang tìm kiếm khoang kho phù hợp...</p>
          </div>
        )}

        {/* 5. EMPTY STATE */}
        {!loading && filteredAndSortedResults.length === 0 && (
          <div className="duo-card p-12 text-center">
            <span className="material-symbols-outlined text-[54px] text-[#AFAFAF]">search_off</span>
            <h3 className="text-lg font-black text-[#4B4B4B] mt-3">
              Không tìm thấy khoang kho phù hợp
            </h3>
            <p className="text-xs font-bold text-[#AFAFAF] mt-1 max-w-sm mx-auto">
              Không có ô kho nào thỏa mãn tiêu chí lọc. Vui lòng mở rộng khoảng giá hoặc chọn khu vực khác.
            </p>
            <button
              onClick={resetFilters}
              className="duo-btn-green px-5 py-2.5 text-xs tracking-wider mt-4"
            >
              ĐẶT LẠI BỘ LỌC
            </button>
          </div>
        )}

        {/* 6. RESULTS GRID DUOLINGO FLAT */}
        {!loading && filteredAndSortedResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAndSortedResults.map((item, idx) => (
              <div
                key={`${item.facilityId}-${item.unitTypeId}-${idx}`}
                className="duo-card p-5 flex flex-col justify-between group hover:border-[#1CB0F6] transition-all"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b-2 border-[#E5E5E5]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="material-symbols-outlined text-[18px] text-[#58CC02]">apartment</span>
                      <span className="text-xs font-black text-[#4B4B4B] truncate">{item.facilityName}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border-2 ${
                      item.availableCount > 2
                        ? 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]'
                        : 'bg-[#FFE8CC] text-[#E58800] border-[#FF9600]'
                    }`}>
                      Còn {item.availableCount} ô
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-[#4B4B4B] group-hover:text-[#1CB0F6] transition-colors">
                    {item.unitTypeName} ({item.areaSqm}m²)
                  </h3>

                  <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                    Kích thước: {item.dimensions}
                  </p>

                  {item.features && (
                    <p className="text-xs font-bold text-[#777777] mt-2 line-clamp-2 leading-relaxed">
                      {item.features}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-xs font-bold text-[#AFAFAF] mt-3">
                    <span className="material-symbols-outlined text-[15px]">location_on</span>
                    <span className="truncate">{item.address} • {item.district}</span>
                  </div>
                </div>

                {/* Card Footer: Giá & Nút Đặt kho Duolingo Green */}
                <div className="mt-5 pt-3.5 border-t-2 border-[#E5E5E5] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black text-[#AFAFAF] uppercase block">Đơn giá tháng</span>
                    <span className="text-lg font-black text-[#58CC02]">
                      {formatVND(item.basePriceMonthly)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleBooking(item.facilityId, item.unitTypeId)}
                    className="duo-btn-green px-5 py-2.5 text-xs tracking-wider"
                  >
                    ĐẶT KHO
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
