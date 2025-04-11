export default function AboutSection() {
  return (
    <section
      id="about"
      style={{
        backgroundImage: "url('/images/about_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "soft-light",
      }}
      className="relative min-h-[600px] flex items-center justify-center py-20 bg-black/40"
    >
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="about-content max-w-4xl mx-auto px-4 text-white relative z-10">
        <h2 className="about-title">За нас</h2>
        <p className="about-text">
          Добре дошли в MotoWorld - вашият доверен партньор в света на мотоциклетите. С дългогодишен опит в бранша, ние
          предлагаме внимателно подбрана селекция от най-добрите мотоциклети на пазара.
        </p>
        <p className="about-text">
          Нашият екип от експерти е тук, за да ви помогне да намерите перфектния мотоциклет, отговарящ на вашите нужди и
          бюджет. Предлагаме богата гама от модели - от спортни до туристически, от градски до офроуд машини, с
          гарантирано качество и изгодни цени.
        </p>
        <p className="about-text">
          В MotoWorld вярваме в изграждането на дългосрочни отношения с нашите клиенти. Затова предлагаме не само
          продажба, но и професионална консултация, следпродажбено обслужване и поддръжка. Доверете се на нас за вашата
          следваща мотоциклетна покупка!
        </p>
      </div>
    </section>
  )
}
