export default function ContactSection() {
  return (
    <section id="contact" className="contact-section">
      <div className="container mx-auto">
        <h2 className="contact-title">Контакти</h2>
        <p className="contact-text">Телефон: +359 889168968</p>
        <p className="contact-text">
          Имейл:{" "}
          <a href="mailto:motoworldbulgaria@gmail.com" className="contact-link">
            motoworldbulgaria@gmail.com
          </a>
        </p>
      </div>
    </section>
  )
}
