import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PublicNavbar from '../../components/PublicNavbar'
import { getAllFacilities, getAllUnitTypes, getCities } from '../../services/facilityService'

function formatVND(amount) {
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export default function PublicLandingPage() {
  const navigate = useNavigate()

  const [facilities, setFacilities] = useState([])
  const [unitTypes, setUnitTypes] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(true)

  // Tab lọc chi nhánh
  const [facilityFilterCity, setFacilityFilterCity] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [facs, types, cts] = await Promise.all([
          getAllFacilities().catch(() => []),
          getAllUnitTypes().catch(() => []),
          getCities().catch(() => []),
        ])
        setFacilities(Array.isArray(facs) ? facs : [])
        setUnitTypes(Array.isArray(types) ? types : [])
        setCities(Array.isArray(cts) ? cts : [])
      } catch (err) {
        console.error('Failed to load landing page data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])



  const filteredFacilities = facilities.filter(
    (f) => !facilityFilterCity || f.city === facilityFilterCity
  )

  return (
    <div className="min-h-screen bg-white text-[#4B4B4B] flex flex-col font-sans">
      
      {/* 1. PUBLIC NAVBAR */}
      <PublicNavbar />

      {/* 2. HERO BANNER DUOLINGO FLAT 2.5D */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F2FBF0] to-white pt-12 pb-20 border-b-2 border-[#E5E5E5]">
        
        {/* Background Decorative Blobs */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-[#58CC02]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#1CB0F6]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center text-center">
          
          {/* Trust Badge Duolingo */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D7FFB8] border-2 border-[#58CC02] text-[#58A700] text-xs font-black uppercase tracking-wider mb-6 shadow-sm">
            <span>🔥</span>
            <span>Hệ thống kho tự quản thông minh hàng đầu Việt Nam</span>
            <span>•</span>
            <span className="text-[#468600]">An ninh cấp 5</span>
          </div>

          {/* Hero Main Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#4B4B4B] tracking-tight max-w-4xl leading-tight">
            Kho Lưu Trữ Thông Minh <br />
            <span className="text-[#58CC02]">Giữ Đồ An Toàn</span>, Nhẹ Nhàng Cuộc Sống
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base text-[#777777] font-bold max-w-2xl leading-relaxed">
            Giải pháp thuê kho tự quản mini cá nhân & doanh nghiệp với khóa SmartLock,
            kiểm soát nhiệt độ 20°C và giám sát AI 24/7. Nhận kho ngay trong 5 phút.
          </p>

          {/* HERO CALL-TO-ACTION BUTTONS DUOLINGO FLAT 2.5D */}
          <div className="mt-9 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('loai-kho')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className="duo-btn-green w-full sm:w-auto px-8 py-4 text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2.5 shadow-lg group cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">inventory_2</span>
              <span>KHÁM PHÁ CÁC LOẠI KHO</span>
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('vi-tri')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
              }}
              className="duo-btn-blue w-full sm:w-auto px-8 py-4 text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2.5 shadow-lg group cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px] group-hover:scale-110 transition-transform">location_on</span>
              <span>XEM VỊ TRÍ CHI NHÁNH</span>
              <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>
          </div>

          {/* DUOLINGO PROMO VOUCHER CARD */}
          <div className="w-full max-w-2xl mt-8 duo-card p-5 sm:p-6 bg-gradient-to-r from-[#FFFDF5] to-[#F2FBF0] border-2 border-b-4 border-[#58CC02] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg text-left">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#D7FFB8] border-2 border-b-4 border-[#58CC02] flex items-center justify-center text-3xl shrink-0 shadow-sm">
                🎁
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFE8CC] text-[#E58800] text-[10px] font-black uppercase tracking-wider mb-1">
                  <span>🔥</span>
                  <span>Ưu đãi thành viên mới</span>
                </div>
                <h4 className="font-black text-sm sm:text-base text-[#4B4B4B]">
                  Giảm ngay 100.000đ khi đặt kho trực tuyến
                </h4>
                <p className="text-xs font-bold text-[#777777] mt-0.5">
                  Áp dụng mã voucher <span className="text-[#58CC02] bg-[#EAF8E0] px-2 py-0.5 rounded-md font-black tracking-wider border border-[#58CC02]/30">NEWKHO</span> khi thanh toán cọc
                </p>
              </div>
            </div>

            <div className="shrink-0 flex sm:flex-col items-center gap-1 text-[11px] font-black text-[#58CC02]">
              <span className="material-symbols-outlined text-[22px]">bolt</span>
              <span>Cấp PIN trong 1 phút</span>
            </div>
          </div>

          {/* TRUST HIGHLIGHT BADGES */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-6 text-xs font-black uppercase tracking-wider text-[#777777]">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#58CC02]">verified</span>
              <span>Không thủ tục rườm rà</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#1CB0F6]">lock</span>
              <span>Mã SmartLock bảo mật</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#FF9600]">local_shipping</span>
              <span>Có xe đẩy & thang hàng</span>
            </div>
          </div>

          {/* Key Metric Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 w-full max-w-4xl text-center">
            <div className="duo-card p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#58CC02] block">6+</span>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider mt-1 block">Chi nhánh trung tâm</span>
            </div>
            <div className="duo-card p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#1CB0F6] block">2m² - 25m²</span>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider mt-1 block">Kích thước đa dạng</span>
            </div>
            <div className="duo-card p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#FF9600] block">24/7</span>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider mt-1 block">Ra vào tự do SmartLock</span>
            </div>
            <div className="duo-card p-4">
              <span className="text-2xl sm:text-3xl font-black text-[#58CC02] block">500 Triệu</span>
              <span className="text-[11px] font-black uppercase text-[#AFAFAF] tracking-wider mt-1 block">Bảo hiểm toàn diện</span>
            </div>
          </div>

        </div>
      </section>


      {/* 3. SECTION 1: SHOW SẢN PHẨM - CÁC LOẠI KHOANG KHO */}
      <section id="loai-kho" className="py-20 bg-white border-b-2 border-[#E5E5E5]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#58CC02] mb-2">
                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                <span>DANH MỤC SẢN PHẨM LƯU TRỮ</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-[#4B4B4B] tracking-tight">
                Kích thước khoang kho đa dạng
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#AFAFAF] mt-2 max-w-xl">
                Từ nhu cầu cất giữ vali, tài liệu cá nhân đến toàn bộ nội thất gia đình hoặc hàng hóa doanh nghiệp.
              </p>
            </div>

            <button
              onClick={() => navigate('/tim-va-dat-kho')}
              className="duo-btn-white px-5 py-2.5 text-xs tracking-wider self-start md:self-auto shrink-0 flex items-center gap-1.5"
            >
              <span>XEM BẢNG SO SÁNH</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* Unit Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {unitTypes.map((ut) => (
              <div
                key={ut.id}
                className="duo-card p-6 flex flex-col justify-between hover:border-[#1CB0F6] transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-[#58A700] bg-[#D7FFB8] border-2 border-[#58CC02] px-3 py-1 rounded-full uppercase">
                      {ut.areaSqm} m² ({ut.volumeCbm || (ut.areaSqm * 2.4).toFixed(1)} m³)
                    </span>
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {ut.dimensions}
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-[#4B4B4B] group-hover:text-[#1CB0F6] transition-colors">
                    {ut.name}
                  </h3>

                  <div className="mt-3 p-3 bg-[#F8F9FA] rounded-xl border border-[#EBEBEB]">
                    <span className="text-[11px] font-black text-[#AFAFAF] uppercase block mb-1">
                      Sức chứa ước tính:
                    </span>
                    <p className="text-xs font-black text-[#4B4B4B] leading-relaxed">
                      📦 {ut.suggestedCapacity || 'Thích hợp đồ gia đình và chuyển nhà'}
                    </p>
                  </div>

                  {ut.features && (
                    <p className="text-xs font-bold text-[#777777] mt-3 leading-relaxed line-clamp-2">
                      💡 {ut.features}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t-2 border-[#E5E5E5] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-[#AFAFAF] uppercase block">Giá thuê khởi điểm</span>
                    <span className="text-lg font-black text-[#58CC02]">
                      {formatVND(ut.basePriceMonthly)}
                      <span className="text-xs text-[#AFAFAF] font-bold">/th</span>
                    </span>
                  </div>

                  <button
                    onClick={() => navigate(`/tim-va-dat-kho/ket-qua?unitTypeId=${ut.id}`)}
                    className="duo-btn-blue px-4 py-2 text-xs tracking-wider flex items-center gap-1"
                  >
                    <span>TÌM KHO</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>


      {/* 4. SECTION 2: SHOW VỊ TRÍ KHO - HỆ THỐNG CHI NHÁNH */}
      <section id="vi-tri" className="py-20 bg-[#F9FAF8] border-b-2 border-[#E5E5E5]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1CB0F6] mb-2">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                <span>MẠNG LƯỚI CHI NHÁNH QUEENKHO</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-[#4B4B4B] tracking-tight">
                Vị trí kho đắc địa, thuận tiện giao thông
              </h2>
              <p className="text-xs sm:text-sm font-bold text-[#AFAFAF] mt-2 max-w-xl">
                Tất cả các cơ sở đều có bãi đỗ xe tải/ô tô tận cửa, thang máy hàng chuyên dụng và bảo vệ 24/7.
              </p>
            </div>

            {/* Quick City Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFacilityFilterCity('')}
                className={`duo-btn px-3.5 py-1.5 rounded-xl font-black text-xs ${
                  !facilityFilterCity
                    ? 'bg-[#1CB0F6] text-white border-2 border-b-4 border-[#1899D6]'
                    : 'duo-btn-gray'
                }`}
              >
                Tất cả ({facilities.length})
              </button>
              {cities.map((c) => {
                const count = facilities.filter((f) => f.city === c).length
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFacilityFilterCity(facilityFilterCity === c ? '' : c)}
                    className={`duo-btn px-3.5 py-1.5 rounded-xl font-black text-xs ${
                      facilityFilterCity === c
                        ? 'bg-[#1CB0F6] text-white border-2 border-b-4 border-[#1899D6]'
                        : 'duo-btn-gray hover:text-[#1CB0F6]'
                    }`}
                  >
                    📍 {c} ({count})
                  </button>
                )
              })}
            </div>
          </div>

          {/* Facilities Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFacilities.map((f) => (
              <div
                key={f.id}
                className="duo-card p-6 flex flex-col justify-between hover:border-[#58CC02] transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-black text-[#4B4B4B] group-hover:text-[#58CC02] transition-colors leading-snug">
                      {f.name}
                    </h3>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase border-2 shrink-0 ${
                      f.totalAvailableUnits > 0
                        ? 'bg-[#D7FFB8] text-[#58A700] border-[#58CC02]'
                        : 'bg-[#FFDFDF] text-[#FF4B4B] border-[#FF4B4B]'
                    }`}>
                      {f.totalAvailableUnits > 0 ? `Còn ${f.totalAvailableUnits} ô trống` : 'Tạm hết ô'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-[#777777] flex items-start gap-1.5 mt-2">
                    <span className="material-symbols-outlined text-[16px] text-[#1CB0F6] shrink-0 mt-0.5">location_on</span>
                    <span>{f.address}, {f.district}, {f.city}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-[#777777]">
                    <span className="bg-[#F0F0F0] px-2.5 py-1 rounded-lg">🚗 Xe tải tận cửa</span>
                    <span className="bg-[#F0F0F0] px-2.5 py-1 rounded-lg">🛗 Thang hàng 2 tấn</span>
                    <span className="bg-[#F0F0F0] px-2.5 py-1 rounded-lg">🔒 SmartLock</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t-2 border-[#E5E5E5] flex items-center justify-between">
                  <div className="text-xs font-black text-[#AFAFAF]">
                    Hotline: <span className="text-[#4B4B4B]">{f.hotline || '1900 6868'}</span>
                  </div>

                  <button
                    onClick={() => navigate(`/tim-va-dat-kho/ket-qua?facilityId=${f.id}`)}
                    className="duo-btn-green px-4 py-2 text-xs tracking-wider flex items-center gap-1"
                  >
                    <span>XEM KHO</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>


      {/* 5. SECTION 3: TIỆN ÍCH AN TÂM (DUOLINGO 2.5D FEATURES) */}
      <section id="tien-ich" className="py-20 bg-white border-b-2 border-[#E5E5E5]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#FF9600] bg-[#FFF2DE] px-3.5 py-1.5 rounded-full border border-[#FF9600]">
              AN TÂM TUYỆT ĐỐI 5 SAO
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#4B4B4B] tracking-tight mt-3">
              Tiêu chuẩn kho bãi hiện đại bậc nhất
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#AFAFAF] mt-2">
              Chúng tôi bảo vệ tài sản của bạn như bảo vệ chính ngôi nhà của mình.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="duo-card p-6 text-center hover:border-[#58CC02] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] flex items-center justify-center text-[#58A700] text-3xl mb-4">
                🔑
              </div>
              <h3 className="font-black text-base text-[#4B4B4B]">Khóa SmartLock Riêng</h3>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2 leading-relaxed">
                Tự cấp mã PIN riêng qua SMS/Web, tự do ra vào kho 24/7 mà không cần gặp quản lý.
              </p>
            </div>

            <div className="duo-card p-6 text-center hover:border-[#1CB0F6] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#DDF4FF] border-2 border-[#1CB0F6] flex items-center justify-center text-[#1CB0F6] text-3xl mb-4">
                🤖
              </div>
              <h3 className="font-black text-base text-[#4B4B4B]">CCTV AI Giám Sát</h3>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2 leading-relaxed">
                Hệ thống camera trí tuệ nhân tạo nhận diện chuyển động và cảnh báo tức thì 24/7.
              </p>
            </div>

            <div className="duo-card p-6 text-center hover:border-[#FF9600] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFE8CC] border-2 border-[#FF9600] flex items-center justify-center text-[#FF9600] text-3xl mb-4">
                ❄️
              </div>
              <h3 className="font-black text-base text-[#4B4B4B]">Kiểm Soát Nhiệt Độ</h3>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2 leading-relaxed">
                Hệ thống điều hòa và kiểm soát độ ẩm 20°C - 25°C, chống ẩm mốc cho tài liệu, đồ gỗ, quần áo.
              </p>
            </div>

            <div className="duo-card p-6 text-center hover:border-[#FF4B4B] transition-colors">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFDFDF] border-2 border-[#FF4B4B] flex items-center justify-center text-[#FF4B4B] text-3xl mb-4">
                🛡️
              </div>
              <h3 className="font-black text-base text-[#4B4B4B]">Bảo Hiểm 500 Triệu</h3>
              <p className="text-xs font-bold text-[#AFAFAF] mt-2 leading-relaxed">
                Mọi hợp đồng thuê đều được bảo hiểm bồi thường rủi ro cháy nổ, thiên tai lên đến 500 triệu.
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* 6. SECTION 4: QUY TRÌNH 3 BƯỚC THUÊ KHO */}
      <section id="quy-trinh" className="py-20 bg-[#F9FAF8] border-b-2 border-[#E5E5E5]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#58CC02] bg-[#D7FFB8] px-3.5 py-1.5 rounded-full border border-[#58CC02]">
              ĐƠN GIẢN & NHANH CHÓNG
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#4B4B4B] tracking-tight mt-3">
              Thuê kho chỉ với 3 bước đơn giản
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="duo-card p-8 text-center relative">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#58CC02] text-white font-black text-lg flex items-center justify-center border-b-4 border-[#58A700] mb-4">
                1
              </div>
              <h3 className="font-black text-lg text-[#4B4B4B]">Chọn Kho Phù Hợp</h3>
              <p className="text-xs font-bold text-[#777777] mt-2 leading-relaxed">
                Xem hình ảnh, kích thước và bảng giá trực tiếp. Chọn cơ sở gần nhà nhất theo từng quận.
              </p>
            </div>

            <div className="duo-card p-8 text-center relative">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#1CB0F6] text-white font-black text-lg flex items-center justify-center border-b-4 border-[#1899D6] mb-4">
                2
              </div>
              <h3 className="font-black text-lg text-[#4B4B4B]">Đặt Cọc Trực Tuyến</h3>
              <p className="text-xs font-bold text-[#777777] mt-2 leading-relaxed">
                Thanh toán tiền cọc giữ chỗ an toàn qua cổng VNPAY. Nhận ngay hợp đồng điện tử và voucher 100k.
              </p>
            </div>

            <div className="duo-card p-8 text-center relative">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#FF9600] text-white font-black text-lg flex items-center justify-center border-b-4 border-[#E58800] mb-4">
                3
              </div>
              <h3 className="font-black text-lg text-[#4B4B4B]">Nhận Kho & Cất Đồ</h3>
              <p className="text-xs font-bold text-[#777777] mt-2 leading-relaxed">
                Hệ thống gửi mã PIN bảo mật vào điện thoại. Bạn có thể đến cất đồ vào kho bất cứ lúc nào!
              </p>
            </div>
          </div>

        </div>
      </section>


      {/* 7. SECTION 5: CALL TO ACTION BANNER */}
      <section className="py-20 bg-gradient-to-r from-[#58CC02] to-[#46A302] text-white text-center">
        <div className="max-w-[800px] mx-auto px-4">
          <span className="text-4xl block mb-3">📦</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Sẵn sàng giải phóng không gian của bạn?
          </h2>
          <p className="text-sm sm:text-base font-bold mt-3 text-white/90">
            Đặt kho ngay hôm nay để nhận ưu đãi giảm 100.000đ cho đơn đầu tiên với mã <strong className="underline">NEWKHO</strong>!
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/tim-va-dat-kho')}
              className="duo-btn-white px-8 py-4 text-xs font-black tracking-wider text-[#58CC02]"
            >
              KHÁM PHÁ KHO NGAY
            </button>
            <button
              onClick={() => navigate('/register')}
              className="duo-btn-blue px-8 py-4 text-xs font-black tracking-wider"
            >
              ĐĂNG KÝ TÀI KHOẢN MIỄN PHÍ
            </button>
          </div>
        </div>
      </section>


      {/* 8. FOOTER DUOLINGO FLAT */}
      <footer className="bg-white border-t-2 border-[#E5E5E5] py-12 text-xs font-bold text-[#AFAFAF]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#58CC02] border-b-2 border-[#58A700] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[22px]">warehouse</span>
            </div>
            <div>
              <span className="font-black text-[#58CC02] text-base block">QUEENKHO VIỆT NAM</span>
              <span className="text-[11px] text-[#AFAFAF]">Hệ thống kho tự quản thông minh & bảo mật</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[#777777]">
            <span className="hover:text-[#58CC02] cursor-pointer" onClick={() => navigate('/tim-va-dat-kho')}>Tìm kho</span>
            <span className="hover:text-[#58CC02] cursor-pointer" onClick={() => navigate('/login')}>Đăng nhập</span>
            <span className="hover:text-[#58CC02] cursor-pointer" onClick={() => navigate('/register')}>Đăng ký</span>
            <span>Hotline: <strong className="text-[#4B4B4B]">1900 6868</strong></span>
          </div>

          <div>
            © {new Date().getFullYear()} QueenKho Self-Storage. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}

