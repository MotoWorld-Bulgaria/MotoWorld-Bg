export default function HeroSection() {
  return (
    <section className="hero-section bg-[url('/hero-background.jpeg')] bg-cover bg-center bg-no-repeat h-screen">
      <div className="flex items-center justify-center h-full bg-black/50">
        <div className="hero-content text-center text-white">
          <h1 className="hero-title text-4xl font-bold">Добре дошли в Moto World</h1>
          <p className="hero-subtitle text-lg mt-2">Изследвайте света на две колела.</p>
        </div>
      </div>
    </section>
  )
}
