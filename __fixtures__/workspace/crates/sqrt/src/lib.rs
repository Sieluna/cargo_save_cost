#![no_std]

pub fn sqrt(value: f64) -> f64 {
    if value <= 0.0 {
        return if value == 0.0 { 0.0 } else { 0.0 }; // Return 0 for negative numbers
    }

    let mut x = if value > 1.0 { value / 2.0 } else { value };
    let mut prev;

    // Newton's method: x_new = (x + value/x) / 2
    let max_iterations = 50;
    let mut iterations = 0;

    loop {
        prev = x;
        x = (x + value / x) / 2.0;

        if (x - prev).abs() < f64::EPSILON * 1000.0 || iterations >= max_iterations {
            break;
        }

        iterations += 1;
    }

    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqrt_positive_numbers() {
        assert!((sqrt(4.0) - 2.0).abs() < f64::EPSILON * 1000.0);
        assert!((sqrt(9.0) - 3.0).abs() < f64::EPSILON * 1000.0);
        assert!((sqrt(16.0) - 4.0).abs() < f64::EPSILON * 1000.0);
        assert!((sqrt(2.0) - 1.4142135623730951).abs() < f64::EPSILON * 1000.0);
    }

    #[test]
    fn test_sqrt_edge_cases() {
        assert_eq!(sqrt(0.0), 0.0);
        assert_eq!(sqrt(1.0), 1.0);
    }

    #[test]
    fn test_sqrt_small_numbers() {
        assert!((sqrt(0.25) - 0.5).abs() < f64::EPSILON * 1000.0);
        assert!((sqrt(0.01) - 0.1).abs() < f64::EPSILON * 1000.0);
    }

    #[test]
    fn test_sqrt_large_numbers() {
        assert!((sqrt(1000000.0) - 1000.0).abs() < f64::EPSILON * 1000000.0);
    }
}
