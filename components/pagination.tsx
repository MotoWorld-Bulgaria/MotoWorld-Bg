"use client"

interface PaginationProps {
  itemsPerPage: number
  totalItems: number
  currentPage: number
  paginate: (pageNumber: number) => void
}

export default function Pagination({ itemsPerPage, totalItems, currentPage, paginate }: PaginationProps) {
  const pageNumbers = []

  for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) {
    pageNumbers.push(i)
  }

  // Logic to show limited page numbers with ellipsis
  const getPageNumbers = () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage)

    if (totalPages <= 5) {
      return pageNumbers
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages]
    }

    if (currentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages]
  }

  return (
    <nav className="flex justify-center mt-8">
      <ul className="flex items-center gap-1">
        <li>
          <button
            onClick={() => currentPage > 1 && paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded-md ${
              currentPage === 1
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
            aria-label="Предишна страница"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
        </li>

        {getPageNumbers().map((number, index) => (
          <li key={index}>
            {number === "..." ? (
              <span className="px-3 py-1">...</span>
            ) : (
              <button
                onClick={() => paginate(number as number)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === number ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {number}
              </button>
            )}
          </li>
        ))}

        <li>
          <button
            onClick={() => currentPage < Math.ceil(totalItems / itemsPerPage) && paginate(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
            className={`px-3 py-1 rounded-md ${
              currentPage >= Math.ceil(totalItems / itemsPerPage)
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
            aria-label="Следваща страница"
          >
            <i className="fas fa-chevron-right text-sm"></i>
          </button>
        </li>
      </ul>
    </nav>
  )
}
