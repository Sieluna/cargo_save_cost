#![no_std]

use sqrt::sqrt;
use vector_sub::sub_vector_2d;
use vector_types::{Vector2, Vector3};

pub fn vector_distance_2d(v1: Vector2, v2: Vector2) -> f64 {
    let diff = sub_vector_2d(v1, v2);
    sqrt(diff.x * diff.x + diff.y * diff.y)
}

pub fn vector_mean_2d(v1: Vector2, v2: Vector2) -> Vector2 {
    Vector2::new((v1.x + v2.x) / 2.0, (v1.y + v2.y) / 2.0)
}

pub fn vector_distance_3d(v1: Vector3, v2: Vector3) -> f64 {
    let dx = v1.x - v2.x;
    let dy = v1.y - v2.y;
    let dz = v1.z - v2.z;
    sqrt(dx * dx + dy * dy + dz * dz)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_distance_2d() {
        let v1 = Vector2::new(0.0, 0.0);
        let v2 = Vector2::new(3.0, 4.0);
        assert!((vector_distance_2d(v1, v2) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_vector_mean_2d() {
        let v1 = Vector2::new(0.0, 0.0);
        let v2 = Vector2::new(4.0, 6.0);
        let mean = vector_mean_2d(v1, v2);
        assert_eq!(mean.x, 2.0);
        assert_eq!(mean.y, 3.0);
    }

    #[test]
    fn test_vector_distance_3d() {
        let v1 = Vector3::new(0.0, 0.0, 0.0);
        let v2 = Vector3::new(1.0, 2.0, 2.0);
        assert!((vector_distance_3d(v1, v2) - 3.0).abs() < 1e-10);
    }
}
